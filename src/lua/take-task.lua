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

local taskId = redis.call('RPOPLPUSH', fromQueue, toQueue)

if taskId then
    local taskKey = taskKeyPrefix .. taskId
    local taskJson = redis.call('GET', taskKey)
    local task = cjson.decode(taskJson)
    task['status'] = status
    task['processingStartedAt'] = datetime

    local lockKey = queue .. ':acknowledged-tasks:' .. taskId
    redis.call('SET', lockKey, '', 'PX', task['stallTimeout'] or defaultStallTimeout)
    redis.call('HSET', stallingHashKey, taskId, '')

    local processingTaskJson = cjson.encode(task)
    redis.call('SET', taskKey, processingTaskJson)
    local event = {createdAt = datetime, type = eventType, task = task}
    redis.call('PUBLISH', publishChannel, cjson.encode(event))

    return processingTaskJson
end
