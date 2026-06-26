#!/usr/bin/env bash
# Tasodifiy ADMIN_API_KEY yaratish
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
