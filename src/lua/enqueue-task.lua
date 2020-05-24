local taskKey = KEYS[1]
local taskString = KEYS[2]
local queuedListKey = KEYS[3]
local taskQueuedChannel = KEYS[4]
local eventType = KEYS[5]
local asOf = KEYS[6]
local taskId = KEYS[7]
local isPausedKey = KEYS[8]
local pausedListKey = KEYS[9]

redis.call('set', taskKey, taskString)

local isPaused = redis.call('get', isPausedKey) == 'true'
if (isPaused) then
    redis.call('lpush', pausedListKey, taskId)
else
    redis.call('lpush', queuedListKey, taskId)
end

local event = {
    createdAt = asOf,
    type = eventType,
    task = cjson.decode(taskString)
}
redis.call('publish', taskQueuedChannel, cjson.encode(event))

return taskString
