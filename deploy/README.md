# Установка обучающих приложений на VPS

Сайт — это сам репозиторий (те же файлы, что на GitHub Pages). `server.py` отдаёт его
и хранит общий прогресс устройств (`/api/progress/<app>`, JSON-файлы). Только стандартная
библиотека Python 3.8+, зависимостей нет.

## Установка

```bash
git clone https://github.com/kiugorbunov-tech/learn /opt/learn
cp /opt/learn/deploy/learn.service /etc/systemd/system/learn.service
systemctl daemon-reload && systemctl enable --now learn
curl -s http://127.0.0.1:8090/ | head -n 3
```

Сервер слушает только `127.0.0.1:8090`. Наружу его выводит nginx (https + basic auth):

```nginx
location / {
    proxy_pass http://127.0.0.1:8090;
    client_max_body_size 2m;
    proxy_read_timeout 120s;
    proxy_buffering off;   # модели перевода ~56 МБ отдаются потоком
}
```

## Обновление

```bash
cd /opt/learn && git pull --ff-only && systemctl restart learn
```

Можно поставить в cron раз в 10 минут: `*/10 * * * * cd /opt/learn && git pull -q --ff-only`.
Перезапуск нужен только при изменении `deploy/server.py`.

## Что где

- `/opt/learn` — сайт (страницы, модели перевода в `models/`).
- `/var/lib/learn/*.json` — прогресс (`english.json`, `course.json`). Это единственное, что стоит бэкапить.
