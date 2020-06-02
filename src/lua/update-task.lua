local taskKey = KEYS[1]
local taskUpdateDataString = KEYS[2]
local asOf = KEYS[3]
local publishChannel = KEYS[4]
local eventType = KEYS[5]

local taskId = redis.call('hget', taskKey, 'id')
if not taskId then return end

local taskUpdateJson = cjson.decode(taskUpdateDataString)

local updateParams = {}
for key, value in pairs(taskUpdateJson) do
    updateParams[#updateParams + 1] = key
    updateParams[#updateParams + 1] = value
end
redis.call('hset', taskKey, unpack(updateParams))

local keysAndValues = redis.call('hgetall', taskKey)
local task = {}
for index = 1, table.getn(keysAndValues), 2 do
    task[keysAndValues[index]] = keysAndValues[index + 1]
end

local event = {createdAt = asOf, type = eventType, task = task}
redis.call('publish', publishChannel, cjson.encode(event))

return cjson.encode(task)
