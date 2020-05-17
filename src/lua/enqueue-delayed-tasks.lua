local delayedSetKey = KEYS[1]
local queuedListKey = KEYS[2]
local nowUnix = tonumber(KEYS[3])
local taskKeyPrefix = KEYS[4]
local status = KEYS[5]

local function map(func, array)
    local new_array = {}
    for i, v in ipairs(array) do new_array[i] = func(v) end
    return new_array
end

local function getTaskKey(taskId) return taskKeyPrefix .. taskId end

local delayedTaskIds = redis.call('zrangebyscore', delayedSetKey, 0, nowUnix)

if #delayedTaskIds > 0 then
    redis.call('lpush', KEYS[2], unpack(delayedTaskIds))
    redis.call('zremrangebyscore', delayedSetKey, 0, nowUnix)
    -- TODO: Use map and MSET
    for i, taskId in ipairs(delayedTaskIds) do
        local taskKey = getTaskKey(taskId)
        local taskString = redis.call('get', taskKey)
        local task = cjson.decode(taskString)
        task['status'] = status
        local updatedTaskString = cjson.encode(task)
        redis.call('set', taskKey, updatedTaskString)
    end
    return redis.call('mget', unpack(map(getTaskKey, delayedTaskIds)))
end

return {}
