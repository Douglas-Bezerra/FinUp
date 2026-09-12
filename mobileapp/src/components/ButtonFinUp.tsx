import {
    StyleProp,
    ViewStyle,
} from "react-native";

import GradientButton from "./GradientButton";

interface ButtonFinUpProps {
    title: string;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export default function ButtonFinUp({
    title,
    onPress,
    style,
}: ButtonFinUpProps) {
    return (
        <GradientButton
            title={title}
            onPress={onPress}
            style={style}
        />
    );
}