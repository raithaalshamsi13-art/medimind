/**
 * "Are you sure?" prompt that works everywhere.
 *
 * `Alert.alert` is a no-op in the browser (react-native-web does not
 * implement it), so a destructive button on the web build would silently do
 * nothing. In the browser we fall back to the built-in confirm dialog.
 */

import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message: string;
  /** Label for the destructive button, e.g. "Delete". */
  confirmLabel: string;
  destructive?: boolean;
};

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const dialog = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    return Promise.resolve(dialog ? dialog(`${options.title}\n\n${options.message}`) : true);
  }

  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
