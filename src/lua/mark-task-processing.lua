local taskId = KEYS[1]
local taskKeyPrefix = KEYS[2]
local stallTimeout = KEYS[3]
local queue = KEYS[4]
local datetime = KEYS[5]
local publishChannel = KEYS[6]
local stallingHashKey = KEYS[7]
local eventType = KEYS[8]
local status = KEYS[9]

local lockKey = queue .. ':acknowledged-tasks:' .. taskId
redis.call('SET', lockKey, '', 'PX', stallTimeout)
redis.call('HSET', stallingHashKey, taskId, '')

local taskKey = taskKeyPrefix .. taskId
local taskJson = redis.call('GET', taskKey)
local task = cjson.decode(taskJson)
task['status'] = status
task['processingStartedAt'] = datetime

local processingTaskJson = cjson.encode(task)
redis.call('SET', taskKey, processingTaskJson)
local event = {createdAt = datetime, type = eventType, task = task}
redis.call('PUBLISH', publishChannel, cjson.encode(event))

return processingTaskJson
