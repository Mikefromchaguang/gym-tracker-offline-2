import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(tabs)");
    }, 600);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: "700" }}>OAuth Disabled</Text>
      <Text style={{ marginTop: 8, textAlign: "center", opacity: 0.8 }}>
        This app is configured for local-only usage.
      </Text>
    </View>
  );
}
