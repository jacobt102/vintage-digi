import { StatusBar } from 'expo-status-bar';
import { usePermissions } from 'expo-media-library';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraScreen } from './src/camera/CameraScreen';

export default function App() {
  // Write-only: the spike saves photos but never reads the existing library, so requesting
  // full access here would ask for more than the app actually uses.
  const [permission, requestPermission] = usePermissions({ writeOnly: true });

  useEffect(() => {
    if (permission != null && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <CameraScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
