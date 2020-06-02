local delayedSetKey = KEYS[1]
local queuedListKey = KEYS[2]
local nowUnix = tonumber(KEYS[3])
local taskKeyPrefix = KEYS[4]
local status = KEYS[5]
local asOf = KEYS[6]
local eventType = KEYS[7]
local taskQueuedChannel = KEYS[8]
local isPausedKey = KEYS[9]
local pausedListKey = KEYS[10]

local function map(func, array)
    local new_array = {}
    for i, v in ipairs(array) do new_array[i] = func(v) end
    return new_array
end

local function getTaskKey(taskId) return taskKeyPrefix .. taskId end

local delayedTaskIds = redis.call('zrangebyscore', delayedSetKey, 0, nowUnix)

if #delayedTaskIds > 0 then
    redis.call('zremrangebyscore', delayedSetKey, 0, nowUnix)

    local isPaused = redis.call('get', isPausedKey) == 'true'
    if (isPaused) then
        redis.call('lpush', pausedListKey, unpack(delayedTaskIds))
    else
        redis.call('lpush', queuedListKey, unpack(delayedTaskIds))
    end

    -- TODO: Use map and MSET
    local tasks = {}
    for i, taskId in ipairs(delayedTaskIds) do
        local taskKey = getTaskKey(taskId)
        redis.call('hset', taskKey, 'status', status)

        local keysAndValues = redis.call('hgetall', taskKey)
        local task = {}
        for index = 1, table.getn(keysAndValues), 2 do
            task[keysAndValues[index]] = keysAndValues[index + 1]
        end

        local event = {createdAt = asOf, type = eventType, task = task}
        redis.call('publish', taskQueuedChannel, cjson.encode(event))
        tasks[i] = cjson.encode(task)
    end
    return tasks
end

return {}
