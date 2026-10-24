# Проверка KinoPub-плагина и Lampa — 2026-10-23

> Это первоначальный аудит upstream. Затем подготовлена отдельная изменённая
> [сборка Lampa](https://github.com/dearlordylord/lampa); актуальные исправления
> и проверки — [PERSONAL-SECURITY.md](https://github.com/dearlordylord/lampa/blob/main/PERSONAL-SECURITY.md).

## Вывод

**Исходную связку с аккаунтом пока не использовать.** В проверенных путях кода не
обнаружены очевидные майнеры, шифровальщики или установщики malware. Но обнаружены
конкретные риски доступа к данным и выполнения удалённого кода. Отсутствие явного
вируса не делает эту связку безопасной.

Форк плагина уменьшает часть рисков. Он **не исправляет ядро Lampa**, не изолирует
плагины и не подтверждает совместимость с телевизором. Следующий допустимый этап —
контролируемая проба фиксированной собственной Lampa с отключёнными socket,
remote configuration и CUB, только с проверенным локальным плагином.

## Что проверено

Зафиксированы три независимых снимка:

- Плагин `mainsync-afk/lampa_kinopub`, [09f5090ed3f860b7054eb1336b5f26c4e67e0eb9](https://github.com/mainsync-afk/lampa_kinopub/tree/09f5090ed3f860b7054eb1336b5f26c4e67e0eb9).
- Готовая веб-сборка `yumata/lampa`, [02df3448ec9139b77ff1f5603785591fe6b4419b](https://github.com/yumata/lampa/tree/02df3448ec9139b77ff1f5603785591fe6b4419b).
- Исходники Lampa `yumata/lampa-source`, [71733ed81f4b13ac1ed1b3328cbbaa7e01afdbd2](https://github.com/yumata/lampa-source/tree/71733ed81f4b13ac1ed1b3328cbbaa7e01afdbd2).

Метод: целевой ручной анализ авторизации, сетевых отправок, логирования, хранилища,
загрузки расширений, WebSocket и серверов; поиск опасных конструкций; локальные
проверки с моками. Источник и готовая сборка проверялись отдельно, их побайтовая
эквивалентность не установлена. Полный построчный аудит всех 58 тысяч строк
веб-сборки и её зависимостей не проводился.

## Плагин KinoPub

### Высокий: сервер автора получает данные просмотра

В [docs/kp.js](https://github.com/mainsync-afk/lampa_kinopub/blob/09f5090ed3f860b7054eb1336b5f26c4e67e0eb9/docs/kp.js#L63)
по умолчанию задан `kinopub.fastcdn.pics`. Плагин сам проверяет `/health` и при
успехе отправляет полные ссылки HLS-мастеров на `/manifest-proxy`. Сервер видит
IP, время и URL, которые могут содержать подписанные параметры доступа к потоку.
OAuth access/refresh токены сами по себе в этот manifest-запрос не добавляются;
не следует путать подписанную ссылку видео с токеном всего аккаунта.

Кроме того, [voice-sync](https://github.com/mainsync-afk/lampa_kinopub/blob/09f5090ed3f860b7054eb1336b5f26c4e67e0eb9/docs/kp.js#L850)
использует имя пользователя KinoPub в URL и отправляет идентификаторы сериалов,
выбор озвучки и снимок состояния эпизодов. В [серверном коде](https://github.com/mainsync-afk/lampa_kinopub/blob/09f5090ed3f860b7054eb1336b5f26c4e67e0eb9/proxy-server/server.js#L453)
GET/PUT/DELETE не требуют авторизации. По известному имени пользователя и ID
сериала можно читать/менять/удалять снимки, если опубликованный сервер работает
так же, как этот код. Реальные записи чужих пользователей не запрашивались.

**В форке:** сервер автора отключён; нет фонового health-запроса; удалённая
voice-sync отключена независимо от наличия прокси. Настройки остаются локальными.
Цена — штатный fallback HLS2 и возможные ограничения озвучки/4K.

### Средний/высокий: отладочные данные и произвольный API-прокси

Логирование включает код активации, username, события других частей Lampa через
глобальные console hooks и полные playback URL. Отправка удалённых логов выключена
при пустом `kp_log_url`, то есть это **не безусловная отправка всех логов автору**.
Но сохранённый URL включает её; в снимке данных нет редактирования секретов.
`kp_proxy` может перенаправить OAuth-запросы и Bearer-заголовки стороннему оператору.

**В форке:** logger заменён на no-op, глобальные console hooks удалены, API-прокси
игнорируется даже при сохранённой настройке, неработающие настройки убраны из UI.
Отключена регистрация выбора озвучки в CUB Storage.sync. Исправлены прямые вставки
названий озвучки в HTML, но это не общий аудит всех шаблонов Lampa.

### Серверы: не публиковать как есть

`proxy-server/server.js` фильтрует часть IP строковыми регулярными выражениями.
Фильтр не защищает от доменов, разрешающихся в локальные адреса, DNS rebinding и
всех IPv6/loopback форм. Белый список CDN удалён. Нет общей авторизации, лимитов
числа записей voice-sync и размера скачиваемого манифеста. Docker публикует порт
на всех интерфейсах; контейнер запускается как root. Это не необходимое условие
для просмотра, серверы форком не используются и не запускались.

`log-server` по умолчанию не требует токена, слушает все интерфейсы и позволяет
читать /tail. Python/Node версии не ограничивают тело логов должным образом.
Они также оставлены лишь для анализа, а не как рекомендуемый деплой.

### Посторонние файлы и секреты

В upstream есть чужой документ с приватными credentials другого сервиса,
диагностические логи, APK, архив Kodi и сторонние образцы. Один из образцов,
`bwa.js`, содержит удалённые eval/evalrun и загрузку внешнего JS; **сам kp.js его
не подключает**, поэтому этот факт не доказывает заражение активного плагина.

Эти файлы удалены из текущего дерева форка. Унаследованная история Git их сохраняет;
владельцу опубликованных секретов нужен их отзыв, а не простое удаление файла.
Секреты не использовались. APK/Kodi не запускались и не объявляются проверенными:
для них проверены только контейнеры/списки файлов и SHA-256, без полного анализа
байткода и без антивирусного заключения. Файлы третьим лицам не загружались.

### Авторизация

В этом проекте есть встроенная пара общего xbmc OAuth-клиента, в отличие от ранее
проверенного kinopub-msx. Это не пароль твоего аккаунта. Токены идут в Bearer
заголовке, OAuth-параметры — в POST body; пароль вводится на сайте KinoPub.
Доступность/правомерность использования общего клиента и успешная активация
с реальным аккаунтом не подтверждены. Поддержка отказала в выдаче новых ключей.

## Ядро Lampa

### Высокий: удалённый JavaScript через терминал, включая пустой код

В [src/core/socket.js](https://github.com/yumata/lampa-source/blob/71733ed81f4b13ac1ed1b3328cbbaa7e01afdbd2/src/core/socket.js#L141)
сообщение `terminal_eval` проходит проверку равенства локального terminal_access
и присланного code. Если оба пусты, выполняется eval. Предварительная успешная
активация терминала не проверяется. Socket и обработка сообщений разрешены
по умолчанию. В [готовой сборке](https://github.com/yumata/lampa/blob/02df3448ec9139b77ff1f5603785591fe6b4419b/app.min.js#L24983)
тот же путь присутствует и подтверждён локальным воспроизведением.

**Граница утверждения:** нужны сообщения через доверенное WebSocket-соединение.
Это не доказательство возможности атаки любым посетителем Интернета и не
доказательство злого умысла автора или текущей атаки. Компрометация/злоупотребление
сервером или путём доставки сообщений даёт выполнение кода в контексте Lampa.
Там находятся токены установленных плагинов. На Samsung это не доказанное
выполнение команд ОС/взлом всего телевизора. Код доступа терминала также передаётся
серверу в socket.send; наличие непустого кода не изолирует от самого сервера.

Проверка: `node security/check-lampa-terminal.cjs /path/to/reviewed/yumata-lampa`.
Использует фактический обработчик из app.min.js, поддельный WebSocket и безвредный
in-memory marker. Никаких реальных подключений, чужих аккаунтов или установки на ТВ.

Возможное исправление для своей сборки — удалить удалённое eval и отключить socket,
а не просто оставить пустой код терминала. **Ядро в этом форке не исправлялось.**

### Расширения не изолированы

[src/core/plugins.js](https://github.com/yumata/lampa-source/blob/71733ed81f4b13ac1ed1b3328cbbaa7e01afdbd2/src/core/plugins.js)
подключает URL как script и исполняет кешированный код; нет sandbox, подписи или
проверки hash. Все плагины получают общий origin/storage, включая `kp_token` и
`kp_refresh`. Обновление по тому же URL может изменить код после проверки.
При CUB-входе в URL расширений также добавляется email в Base64 — это кодировка,
не шифрование. Резервная копия CUB при подтверждённом пользователем экспорте
включает localStorage почти целиком и может захватить токены других плагинов.
Нельзя считать, что любой случайный плагин безопасен благодаря наличию Lampa.

### Старые библиотеки и внешние сервисы

В снимке веб-сборки jQuery **3.2.1**, в то время как важные исправления обработки
HTML внесены в 3.5.0. См. [официальное advisory](https://github.com/jquery/jquery/security/advisories/GHSA-gxr4-xjj5-5px2).
Это конкретный устаревший компонент, но эксплуатация именно в этом интерфейсе
не воспроизводилась. Обновление требует проверки совместимости.

Обнаружены штатные CUB/socket/metadata/рекламные интеграции и условная загрузка
внешнего JS. Они расширяют доверенную поверхность, но сами по себе не доказывают
malware. Не все включены на каждом запуске. README ведёт на исходники, однако
публичная веб-версия/сторонняя WGT/APK и наш снимок не обязаны совпадать.
[SECURITY.md Lampa](https://github.com/yumata/lampa/blob/02df3448ec9139b77ff1f5603785591fe6b4419b/SECURITY.md)
также прямо предупреждает о безопасности данных и сторонних расширениях.

## Проверки и пределы

- `node smoke-test.js`: 25 проверок запуска/приватности с поддельным аккаунтом,
  включая сохранённые чужие log/proxy URL, открытие карточки и HTML в названии озвучки.
  Тест временно открывает внутреннюю функцию рендера в VM только для проверки HTML.
- Исходный upstream тем же тестом отвергнут: обнаружены фоновые обращения,
  сторонний маршрут API, CUB-sync и обращения после открытия карточки.
- `node --check docs/kp.js`: синтаксис исправленного плагина корректен.
- Локальное воспроизведение terminal_eval успешно на зафиксированной веб-сборке.
- Внешние серверы не атакованы, чужая voice-sync база не читалась,
  реальные credentials не вводились, серверы не разворачивались.
- Полного антивирусного/динамического анализа всех архивов и цепочки сборки нет.
  Плеер, API и Samsung QN55LS03BAFXZC вживую не проверены.

## UI follow-up: personal build 3

A real-DOM fixture found issues not covered by the original boot mocks: current
Lampa emits `full.body` / `full.link`, while the plugin accessed the obsolete
`full.object.activity`; the old torrent anchor also belongs to a hidden source
container. The plugin now mounts one visible KinoPub button in the primary row.
The author had removed pre-play voice choices in favor of proxy-based switching;
those choices and their dispatch are restored, with audio entries before seasons.

`security/card-button.cjs` uses jsdom 26.1.0 and the vendored jQuery. It checks
button visibility through ancestor styles, duplicate events, the Japanese menu
entry and its dispatch to voice index 1. The previous event path fails to mount;
removing restored voice entries makes the test fail. No account/network is used.
A specific Bleach API response and TV audio output remain unverified.

## Personal build 4: real playback audio selection

Reproduced requested-Japanese/default-Russian playback with the delivered Lampa hls.js track wrapper: previous plugin could set a Japanese UI label but could not access Lampa's private hls instance. The regression now builds real plugin play elements, starts a clicked episode after building other playlist entries, and observes the actual Lampa enabled setter changing the backend track. Removed synthetic single-entry voiceovers and the next-episode label override for direct playback. Match tracks by API track number in the rendition name, unique language, or complete unlabelled list; never use API array position as a rendition ID. Player start restores each episode's own selection. Missing or ambiguous tracks keep the actual player list and show a local notice. No proxy or remote logging was reintroduced.

Local tests do not verify Samsung hardware, the user's Bleach API response, codec decoding, or audibility.

## Personal build 5: opt-in diagnostic attachment

The optional KpAudioDiagnostics hook attaches only our bundled, read-only telemetry module. Player metadata now includes the selected audio codec and channel count so diagnostics do not need account data or source URLs. No arbitrary JavaScript execution, author server, global console logger, or remote control was added. The module and exact temporary upload destination are pinned and reviewed in the Lampa repository.

## Personal build 6: preserve audio intent across failures

The user reproduced Japanese-selected/Russian-audible playback with HLS4. Live, redacted metadata showed a fatal playback error before a single unlabelled audio track became available. The actual plugin error callback reproduced the wrong-language fallback: HLS4 failure selected HLS2, which is documented in this code as default/single-audio. A failing regression now covers that callback. For nondefault API audio indices, HLS2 is excluded both from initial URL fallback and from playback-error fallback. Default Russian retains its existing HLS2 fallback. Exhaustion no longer passes false as a URL to Lampa.

The active format is carried as a local enum for opt-in diagnostics. This fixes the demonstrated fallback defect; it does not establish why HLS4 failed, nor prove audible Japanese on Samsung.

## Personal build 7: legacy HLS pathname audio selector

Static inspection of CDNServices' published client revealed legacy HLS audio selection by replacing the master-v1aN pathname. The compatibility helper was implemented independently, with no third-party app code, additional network domains, analytics or scripts. It preserves signed queries and prefixes, updates all quality/fallback URLs, and skips in-stream track toggling when audio has been selected by the master URL. Regression tests first failed for Japanese URL/quality selection, then passed. See CDNSERVICES-PROTOCOL.md for primary links and attribution limitations. Real TV audibility remains to be checked.
