local taskKey = KEYS[1]
local taskUpdateDataString = KEYS[2]
local asOf = KEYS[3]
local publishChannel = KEYS[4]

local taskString = redis.call('get', taskKey)
if not taskString then return end

local taskJson = cjson.decode(taskString)
local taskUpdateJson = cjson.decode(taskUpdateDataString)

for k, v in pairs(taskUpdateJson) do taskJson[k] = v end

local updatedTaskString = cjson.encode(taskJson)
redis.call('set', taskKey, updatedTaskString)

local event = {createdAt = asOf, type = 'task_updated', task = taskJson}
redis.call('publish', publishChannel, cjson.encode(event))

return updatedTaskString
