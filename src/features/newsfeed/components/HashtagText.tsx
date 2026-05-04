import React from "react";
import { Text } from "react-native";

interface Props {
  text: string;
}

/**
 * Renders text with hashtags highlighted in blue for React Native.
 */
export const HashtagText: React.FC<Props> = ({ text }) => {
  if (!text) return null;

  const parts = text.split(/(#\w+)/g);

  return (
    <Text>
      {parts.map((part, i) => {
        if (part.startsWith("#") && part.length > 1) {
          return (
            <Text key={i} className="font-medium text-blue-500">
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
};
