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
    redis.call('hset', taskKey, 'status', status, 'processingStartedAt',
               datetime)

    local lockKey = queue .. ':acknowledged-tasks:' .. taskId
    local stallTimeout = redis.call('hget', taskKey, 'stallTimeout')
    redis.call('set', lockKey, '', 'px', stallTimeout or defaultStallTimeout)
    redis.call('hset', stallingHashKey, taskId, '')

    local keysAndValues = redis.call('hgetall', taskKey)

    local task = {}
    for index = 1, table.getn(keysAndValues), 2 do
        task[keysAndValues[index]] = keysAndValues[index + 1]
    end

    local event = {createdAt = datetime, type = eventType, task = task}
    redis.call('publish', publishChannel, cjson.encode(event))

    return cjson.encode(task)
end
