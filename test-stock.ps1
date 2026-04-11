$resp = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method POST -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json'
$token = $resp.data.accessToken
Invoke-RestMethod -Uri 'http://localhost:3000/api/inventory/stock' -Headers @{"Authorization"="Bearer $token"}