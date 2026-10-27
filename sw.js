const CACHE_PREFIX = "ricos-tamales-luz-";

const CACHE_NAME = "ricos-tamales-luz-v1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./data.json",
    "./manifest.json",
    "./assets/tamal-hero.jpg",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png"
];


// INSTALACIÓN
self.addEventListener("install", event => {

    event.waitUntil(
        (async () => {

            const cache = await caches.open(CACHE_NAME);

            // Un recurso faltante no debe cancelar
            // toda la instalación del Service Worker.
            await Promise.all(
                APP_SHELL.map(async path => {

                    try {

                        const url = new URL(
                            path,
                            self.registration.scope
                        );

                        await cache.add(
                            new Request(url, {
                                cache: "reload"
                            })
                        );

                    } catch (error) {

                        console.warn(
                            "No se pudo almacenar:",
                            path,
                            error
                        );

                    }

                })
            );

            await self.skipWaiting();

        })()
    );

});


// ACTIVACIÓN Y LIMPIEZA DE CACHÉS ANTIGUAS
self.addEventListener("activate", event => {

    event.waitUntil(
        (async () => {

            const cacheNames = await caches.keys();

            await Promise.all(

                cacheNames
                    .filter(name =>
                        name.startsWith(CACHE_PREFIX) &&
                        name !== CACHE_NAME
                    )
                    .map(name => caches.delete(name))

            );

            await self.clients.claim();

        })()
    );

});


// INTERCEPTAR PETICIONES
self.addEventListener("fetch", event => {

    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // No interceptar peticiones externas.
    if (url.origin !== self.location.origin) {
        return;
    }

    // PÁGINAS HTML: intentar conexión y recurrir
    // a la versión almacenada cuando no haya Internet.
    if (request.mode === "navigate") {

        event.respondWith(

            (async () => {

                const cache = await caches.open(CACHE_NAME);

                try {

                    const response = await fetch(request);

                    if (response.ok) {

                        await cache.put(
                            new URL(
                                "./index.html",
                                self.registration.scope
                            ),
                            response.clone()
                        );

                    }

                    return response;

                } catch (error) {

                    const cachedPage = await cache.match(
                        new URL(
                            "./index.html",
                            self.registration.scope
                        )
                    );

                    if (cachedPage) {
                        return cachedPage;
                    }

                    return new Response(
                        "No hay conexión y la página todavía no está disponible sin conexión.",
                        {
                            status: 503,
                            headers: {
                                "Content-Type": "text/plain; charset=utf-8"
                            }
                        }
                    );

                }

            })()

        );

        return;
    }

    // JSON: intentar obtener la configuración más reciente.
    // Si no hay Internet, utilizar la versión guardada.
    if (url.pathname.endsWith("/data.json")) {

        event.respondWith(

            (async () => {

                const cache = await caches.open(CACHE_NAME);

                const cacheKey = new URL(
                    "./data.json",
                    self.registration.scope
                );

                try {

                    const response = await fetch(request);

                    if (response.ok) {

                        await cache.put(
                            cacheKey,
                            response.clone()
                        );

                    }

                    return response;

                } catch (error) {

                    const cachedData = await cache.match(cacheKey);

                    if (cachedData) {
                        return cachedData;
                    }

                    return new Response(
                        JSON.stringify({
                            error: "Configuración no disponible sin conexión"
                        }),
                        {
                            status: 503,
                            headers: {
                                "Content-Type": "application/json"
                            }
                        }
                    );

                }

            })()

        );

        return;
    }

    // RECURSOS ESTÁTICOS: caché primero.
    // Si no existen en caché, consultar la red.
    event.respondWith(

        (async () => {

            const cachedResponse = await caches.match(
                request,
                {
                    ignoreSearch: true
                }
            );

            if (cachedResponse) {
                return cachedResponse;
            }

            const response = await fetch(request);

            if (response.ok) {

                const cache = await caches.open(CACHE_NAME);

                await cache.put(
                    request,
                    response.clone()
                );

            }

            return response;

        })()

    );

});