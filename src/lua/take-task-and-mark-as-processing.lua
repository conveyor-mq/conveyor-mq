local fromQueue = KEYS[1]
local toQueue = KEYS[2]
local stallingHashKey = KEYS[3]

local taskKeyPrefix = ARGV[1]
local defaultStallTimeout = ARGV[2]
local queue = ARGV[3]
local datetime = ARGV[4]
local publishChannel = ARGV[5]
local eventType = ARGV[6]
local status = ARGV[7]

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
