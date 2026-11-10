import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { Platform } from 'react-native';

/** Back is a chevron on iOS and an arrow on Android, as each platform draws it. */
export const BackIcon = Platform.OS === 'ios' ? ChevronLeft : ArrowLeft;
