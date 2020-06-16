local taskKey = KEYS[1]

local taskUpdateDataString = ARGV[1]
local asOf = ARGV[2]
local publishChannel = ARGV[3]
local eventType = ARGV[4]

local taskString = redis.call('get', taskKey)
if not taskString then return end

local taskJson = cjson.decode(taskString)
local taskUpdateJson = cjson.decode(taskUpdateDataString)

for k, v in pairs(taskUpdateJson) do taskJson[k] = v end

local updatedTaskString = cjson.encode(taskJson)
redis.call('set', taskKey, updatedTaskString)

local event = {createdAt = asOf, type = eventType, task = taskJson}
redis.call('publish', publishChannel, cjson.encode(event))

return updatedTaskString
