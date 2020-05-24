local taskKey = KEYS[1]
local taskString = KEYS[2]
local queuedListKey = KEYS[3]
local taskQueuedChannel = KEYS[4]
local eventType = KEYS[5]
local asOf = KEYS[6]
local taskId = KEYS[7]

redis.call('set', taskKey, taskString)
redis.call('lpush', queuedListKey, taskId)

local event = {
    createdAt = asOf,
    type = eventType,
    task = cjson.decode(taskString)
}
redis.call('publish', taskQueuedChannel, cjson.encode(event))

return taskString
