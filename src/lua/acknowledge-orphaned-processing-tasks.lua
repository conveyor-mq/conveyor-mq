local processingListKey = KEYS[1]
local stallingHashKey = KEYS[2]

local taskKeyPrefix = ARGV[1]
local queue = ARGV[2]
local defaultStallTimeout = ARGV[3]

local function difference(a, b)
    local aa = {}
    for k, v in pairs(a) do aa[v] = true end
    for k, v in pairs(b) do aa[v] = nil end
    local ret = {}
    local n = 0
    for k, v in pairs(a) do
        if aa[v] then
            n = n + 1
            ret[n] = v
        end
    end
    return ret
end

local function getTaskKey(taskId) return taskKeyPrefix .. taskId end

local processingTaskIds = redis.call('lrange', processingListKey, 0, -1)

if #processingTaskIds > 0 then
    local stallingTaskIds = redis.call('hkeys', stallingHashKey)
    local taskIdsToAcknowledge = difference(processingTaskIds, stallingTaskIds)

    for i, taskId in ipairs(taskIdsToAcknowledge) do
        local taskKey = getTaskKey(taskId)
        local taskString = redis.call('get', taskKey)
        local task = cjson.decode(taskString)

        local lockKey = queue .. ':acknowledged-tasks:' .. taskId
        redis.call('set', lockKey, '', 'px',
                   task['stallTimeout'] or defaultStallTimeout)
        redis.call('hset', stallingHashKey, taskId, '')
    end

    return taskIdsToAcknowledge
end

return {}
