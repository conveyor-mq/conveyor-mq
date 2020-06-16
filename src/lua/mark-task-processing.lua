local taskKey = KEYS[1]
local stallingHashKey = KEYS[2]
local acknowledgedKey = KEYS[3]

local defaultStallTimeout = ARGV[1]
local datetime = ARGV[2]
local publishChannel = ARGV[3]
local eventType = ARGV[4]
local status = ARGV[5]
local taskId = ARGV[6]

local taskJson = redis.call('get', taskKey)
local task = cjson.decode(taskJson)
task['status'] = status
task['processingStartedAt'] = datetime

redis.call('set', acknowledgedKey, '', 'px', task['stallTimeout'] or defaultStallTimeout)
redis.call('hset', stallingHashKey, taskId, '')

local processingTaskJson = cjson.encode(task)
redis.call('set', taskKey, processingTaskJson)
local event = {createdAt = datetime, type = eventType, task = task}
redis.call('publish', publishChannel, cjson.encode(event))

return processingTaskJson
