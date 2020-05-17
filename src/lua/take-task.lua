local fromQueue = KEYS[1]
local toQueue = KEYS[2]
local taskKeyPrefix = KEYS[3]
local defaultStallTimeout = KEYS[4]
local queue = KEYS[5]
local datetime = KEYS[6]
local publishChannel = KEYS[7]
local stallingHashKey = KEYS[8]
local eventType = KEYS[9]
local status = KEYS[10]

local taskId = redis.call('rpoplpush', fromQueue, toQueue)

if taskId then
    local taskKey = taskKeyPrefix .. taskId
    local taskJson = redis.call('get', taskKey)
    local task = cjson.decode(taskJson)
    task['status'] = status
    task['processingStartedAt'] = datetime

    local lockKey = queue .. ':acknowledged-tasks:' .. taskId
    redis.call('set', lockKey, '', 'px', task['stallTimeout'] or defaultStallTimeout)
    redis.call('hset', stallingHashKey, taskId, '')

    local processingTaskJson = cjson.encode(task)
    redis.call('set', taskKey, processingTaskJson)
    local event = {createdAt = datetime, type = eventType, task = task}
    redis.call('publish', publishChannel, cjson.encode(event))

    return processingTaskJson
end
