local jobId = redis.call("RPOPLPUSH", KEYS[1], KEYS[2])

if jobId then
    local jobKey = ARGV[1] .. jobId
    local lockKey = jobKey .. ':lock'
    rcall("SET", lockKey, ARGV[2], "PX", ARGV[3])
    return {rcall("GET", jobKey), jobId}
end
