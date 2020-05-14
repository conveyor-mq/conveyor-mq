local delayedSetKey = KEYS[1]
local queuedListKey = KEYS[2]
local nowUnix = tonumber(KEYS[3])
local taskKeyPrefix = KEYS[4]

local function map(func, array)
    local new_array = {}
    for i, v in ipairs(array) do new_array[i] = func(v) end
    return new_array
end

local function getTaskId(taskId) return taskKeyPrefix .. taskId end

local delayedTaskIds = redis.call("zrangebyscore", delayedSetKey, 0, nowUnix)

if #delayedTaskIds > 0 then
    redis.call("lpush", KEYS[2], unpack(delayedTaskIds))
    redis.call("zremrangebyscore", delayedSetKey, 0, nowUnix)
    return redis.call("MGET", unpack(map(getTaskId, delayedTaskIds)))
end

return {}
