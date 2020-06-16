local scheduledSetKey = KEYS[1]
local queuedListKey = KEYS[2]
local isPausedKey = KEYS[3]
local pausedListKey = KEYS[4]

local nowUnix = tonumber(ARGV[1])
local taskKeyPrefix = ARGV[2]
local status = ARGV[3]
local asOf = ARGV[4]
local eventType = ARGV[5]
local taskQueuedChannel = ARGV[6]

local function map(func, array)
    local new_array = {}
    for i, v in ipairs(array) do new_array[i] = func(v) end
    return new_array
end

local function getTaskKey(taskId) return taskKeyPrefix .. taskId end

local delayedTaskIds = redis.call('zrangebyscore', scheduledSetKey, 0, nowUnix)

if #delayedTaskIds > 0 then
    redis.call('zremrangebyscore', scheduledSetKey, 0, nowUnix)

    local isPaused = redis.call('get', isPausedKey) == 'true'
    if (isPaused) then
        redis.call('lpush', pausedListKey, unpack(delayedTaskIds))
    else
        redis.call('lpush', queuedListKey, unpack(delayedTaskIds))
    end

    -- TODO: Use map and MSET
    for i, taskId in ipairs(delayedTaskIds) do
        local taskKey = getTaskKey(taskId)
        local taskString = redis.call('get', taskKey)
        local task = cjson.decode(taskString)
        task['status'] = status
        local updatedTaskString = cjson.encode(task)
        redis.call('set', taskKey, updatedTaskString)
        local event = {
            createdAt = asOf,
            type = eventType,
            task = cjson.decode(taskString)
        }
        redis.call('publish', taskQueuedChannel, cjson.encode(event))
    end
    return redis.call('mget', unpack(map(getTaskKey, delayedTaskIds)))
end

return {}
