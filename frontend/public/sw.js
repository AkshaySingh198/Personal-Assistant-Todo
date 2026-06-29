self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const soundUrl = data.soundUrl || '/sounds/custom-alert.wav';

    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/badge.png',
      vibrate: [300, 100, 300, 100, 400],
      tag: data.taskId || 'generic-task', // prevents duplicate notifications
      renotify: true, // play sound/vibe on new push even if not cleared
      data: {
        url: data.taskId ? `/dashboard?task=${data.taskId}` : '/',
        taskId: data.taskId,
        soundUrl
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Personal Assistant', options)
        .then(() => playNotificationSound(soundUrl))
    );
  } catch (err) {
    console.error("Push error:", err);
  }
});

// Core sound function — tries open windows first, falls back to silent audio page
async function playNotificationSound(soundUrl) {
  const allClients = await self.clients.matchAll({ 
    type: 'window', 
    includeUncontrolled: true 
  });

  // Find a visible/focused window first, then any window
  const activeClient = allClients.find(c => c.visibilityState === 'visible') 
                    || allClients[0];

  if (activeClient) {
    // App is open — tell it to play
    activeClient.postMessage({ type: 'PLAY_SOUND', soundUrl });
  } else {
    // App is closed — open a silent helper page that just plays the sound
    // This page should auto-close after playing
    if (self.clients.openWindow) {
      await self.clients.openWindow(`/notification-sound.html?src=${encodeURIComponent(soundUrl)}`);
    }
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find if app window is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            return client.navigate(event.notification.data.url);
          });
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
