local taskId = KEYS[1]
local taskStatus = KEYS[2]
local resultString = KEYS[3]
local taskKey = KEYS[4]
local asOf = KEYS[5]
local remove = KEYS[6]
local successListKey = KEYS[7]
local processingListKey = KEYS[8]
local stallingHashKey = KEYS[9]
local successEventType = KEYS[10]
local completeEventType = KEYS[11]
local taskSuccessChannel = KEYS[12]
local taskCompleteChannel = KEYS[13]

redis.call('lrem', processingListKey, 1, taskId)
redis.call('hdel', stallingHashKey, taskId)

local taskString = redis.call('get', taskKey)
local taskJson = cjson.decode(taskString)
taskJson['result'] = cjson.decode(resultString)
taskJson['status'] = taskStatus
taskJson['processingEndedAt'] = asOf

if remove == 'true' then
    redis.call('del', taskKey)
else
    redis.call('set', taskKey, cjson.encode(taskJson))
    redis.call('lpush', successListKey, taskId)
end

local successEvent = {
    createdAt = asOf,
    type = successEventType,
    task = taskJson
}
redis.call('publish', taskSuccessChannel, cjson.encode(successEvent))

local completeEvent = {
    createdAt = asOf,
    type = completeEventType,
    task = taskJson
}
redis.call('publish', taskCompleteChannel, cjson.encode(completeEvent))

return cjson.encode(taskJson)
