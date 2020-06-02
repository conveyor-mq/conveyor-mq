local isPausedKey = KEYS[1]
local queuedListKey = KEYS[2]
local pausedListKey = KEYS[3]
local taskId = KEYS[4]

local isPaused = redis.call('get', isPausedKey) == 'true'

if (isPaused) then
    redis.call('lpush', pausedListKey, taskId)
else
    redis.call('lpush', queuedListKey, taskId)
end
