local taskKey = KEYS[1]
local queuedListKey = KEYS[2]
local isPausedKey = KEYS[3]
local pausedListKey = KEYS[4]

local taskString = ARGV[1]
local taskQueuedChannel = ARGV[2]
local eventType = ARGV[3]
local asOf = ARGV[4]
local taskId = ARGV[5]

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
