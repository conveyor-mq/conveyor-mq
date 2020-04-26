local taskId = redis.call('RPOPLPUSH', KEYS[1], KEYS[2])

if taskId then
    local lockKey = KEYS[5] .. ':acknowledged-tasks:' .. taskId
    redis.call('SET', lockKey, '', 'PX', KEYS[4])
    local taskKey = KEYS[3] .. taskId
    return redis.call('GET', taskKey)
end
