local taskId = KEYS[1]
local taskKeyPrefix = KEYS[2]
local defaultStallTimeout = KEYS[3]
local queue = KEYS[4]
local datetime = KEYS[5]
local publishChannel = KEYS[6]
local stallingHashKey = KEYS[7]
local eventType = KEYS[8]
local status = KEYS[9]

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
