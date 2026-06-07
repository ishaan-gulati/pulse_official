import React from 'react';
import { View, TextInput, StyleSheet, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';

type FlexTextInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

/** TextInput that reliably shrinks inside horizontal flex rows (avoids placeholder overflow). */
const FlexTextInput: React.FC<FlexTextInputProps> = ({ style, containerStyle, ...props }) => (
  <View style={[styles.wrap, containerStyle]}>
    <TextInput
      {...props}
      style={[styles.input, style]}
      multiline={props.multiline ?? false}
    />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    minWidth: 0,
    padding: 0,
    margin: 0,
  },
});

export default FlexTextInput;
