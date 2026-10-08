# location-блоки панелей — include внутри server {}
# https://habitpro.ru/tools/ | /pgadmin/ | /grafana/ | /prometheus/ | /redis/

location = /tools {
    return 301 $tools_redirect_scheme://$http_host/tools/;
}

location /tools/ {
    alias /usr/share/nginx/monitoring/;
    index index.html;
}

location /pgadmin/ {
    proxy_set_header X-Script-Name /pgadmin;
    proxy_set_header X-Scheme $tools_proxy_scheme;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $tools_proxy_scheme;
    proxy_pass http://pgadmin_upstream/;
    proxy_redirect off;
}

# Полный URI /grafana/… уходит в Grafana (без strip и без 301 /grafana → /grafana/).
location ^~ /grafana {
    proxy_pass http://grafana_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $tools_proxy_scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_redirect off;
}

location /prometheus/ {
    proxy_pass http://prometheus_upstream/prometheus/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $tools_proxy_scheme;
}

# Redis Insight (redis_gui:5540, RI_PROXY_PATH=/redis) — тот же паттерн, что и /grafana
location ^~ /maildev {
    proxy_pass http://maildev_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $tools_proxy_scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_redirect off;
}

location ^~ /redis {
    proxy_pass http://redis_insight_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $tools_proxy_scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_redirect off;
    proxy_read_timeout 300s;
    proxy_buffering off;
}
