// Envoltorio de SOLO avisos locales de expo-notifications.
//
// Por qué no importamos el paquete raíz (`expo-notifications`):
// al cargarlo, `index.js` arrastra el auto-registro de tokens push
// (`getExpoPushTokenAsync` → `DevicePushTokenAutoRegistration.fx`), que en el
// ámbito global llama `addPushTokenListener` y en Android dentro de Expo Go
// **lanza un Error** (el push remoto se quitó de Expo Go en SDK 53). Ese throw
// tumbaba las pantallas al importar el módulo.
//
// Aquí importamos únicamente los submódulos que usan los recordatorios locales:
// nada de push, nada de tokens, nada que lance en Expo Go. El paquete no tiene
// campo `exports`, así que las rutas profundas son válidas (versión fijada).
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';

export {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
};
