import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export const PROFILE_AVATARS = [
  { url: '/avatars/milo.svg', name: 'Milo', trait: 'Easygoing' },
  { url: '/avatars/leo.svg', name: 'Leo', trait: 'Big energy' },
  { url: '/avatars/anya.svg', name: 'Anya', trait: 'Bold' },
  { url: '/avatars/zuri.svg', name: 'Zuri', trait: 'Curious' },
  { url: '/avatars/trex.svg', name: 'Rex', trait: 'Tiny roar' },
  { url: '/avatars/lion.svg', name: 'Sunny', trait: 'Brave heart' },
] as const;

type Props = { avatarUrl: string; size: number };

export function ProfileAvatarArt({ avatarUrl, size }: Props) {
  const index = PROFILE_AVATARS.findIndex((avatar) => avatar.url === avatarUrl);
  const id = index < 0 ? 0 : index;
  const backgrounds = ['#69BCE6', '#9887E8', '#F080A2', '#F4A05C', '#82C878', '#F1B650'];
  const skins = ['#E7AC82', '#C98A69', '#C9866B', '#965F49', '#4D9C62', '#EFBD68'];
  const hairs = ['#24384C', '#392D31', '#302331', '#211F25', '#78C579', '#9A572D'];
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Circle cx="48" cy="48" r="48" fill={backgrounds[id]} />
      {id === 4 ? (
        <>
          <Path d="M15 96c3-19 15-29 33-29s30 10 33 29" fill="#356D52" />
          <Path d="M27 51Q23 22 49 19q23 0 23 24 0 10-11 13l8 12-16 8-12-15q-15 4-18-10" fill={skins[id]} />
          <Path d="m31 33 7-9 5 8m10-11 4 9 8-6" fill={skins[id]} />
          <Circle cx="43" cy="42" r="4" fill="#fff" /><Circle cx="44" cy="42" r="2" fill="#172D24" />
          <Path d="M51 48q8 0 12 7-9 7-20 1m4-2 4 4 3-4 4 4 3-3" fill="none" stroke="#F3F5D5" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="69" cy="27" r="3" fill="#FFF3A6" />
        </>
      ) : id === 5 ? (
        <>
          <Path d="M16 96c3-20 14-31 32-31s29 11 32 31" fill="#8B572B" />
          <Circle cx="48" cy="45" r="34" fill="#B96B2D" /><Circle cx="48" cy="45" r="26" fill={skins[id]} />
          <Path d="m24 34-4-14 15 6m37 8 4-14-15 6" fill={skins[id]} stroke="#9A572D" strokeWidth="3" />
          <Circle cx="37" cy="46" r="2.5" fill="#39291F" /><Circle cx="59" cy="46" r="2.5" fill="#39291F" />
          <Ellipse cx="48" cy="56" rx="13" ry="10" fill="#FFF0D0" /><Path d="m44 52 4-3 4 3-4 4zm4 4v5m0 0q-5 5-9 0m9 0q5 5 9 0" fill="none" stroke="#70412E" strokeWidth="2" strokeLinecap="round" />
          <Path d="M20 47q-7 1-9 5m13 3-11 5m51-13q10 1 13 5m-14 3 12 5" fill="none" stroke="#9A572D" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Path d="M16 96c3-20 14-31 32-31s29 11 32 31" fill={id === 0 ? '#174B70' : id === 1 ? '#593F89' : '#A52D62'} />
          <Path d="M32 65h32v18c-9 11-23 11-32 0z" fill={skins[id]} />
          {id === 2 ? <Path d="M23 42q-8-29 15-31 11-1 17 5 22-4 19 27l-2 23q-10-4-11-18V39q-16 7-32-1v28q-6-4-6-24" fill={hairs[id]} /> : <Path d="M23 43Q19 16 46 13q28-2 28 26l-8-7q-20 8-37-1z" fill={hairs[id]} />}
          <Ellipse cx="48" cy="43" rx="25" ry="29" fill={skins[id]} />
          <Path d={id === 0 ? 'M23 43Q17 12 48 13q30 0 26 31l-7-12q-17 7-36-2z' : id === 1 ? 'M23 43Q19 16 46 13q28-2 28 26l-8-7q-20 8-37-1z' : id === 2 ? 'M25 39Q27 13 48 14q20 0 24 24-17 5-34-2z' : 'M24 39Q21 12 47 13q28 0 26 31l-8-9-7 6-9-8-9 7-9-5z'} fill={hairs[id]} />
          <Path d="M30 41q7-6 14 0m8 0q7-6 14 0" fill="none" stroke={hairs[id]} strokeWidth="3.5" strokeLinecap="round" />
          <Circle cx="38" cy="47" r="2.4" fill="#29242D" /><Circle cx="58" cy="47" r="2.4" fill="#29242D" />
          <Path d="M42 57q6 7 12 0m-17 14 11 8 11-8" fill="none" stroke="#873F46" strokeWidth="2.5" strokeLinecap="round" />
          {id === 1 && <Path d="M66 24q7-7 12 0" fill="none" stroke="#F9E27D" strokeWidth="3" strokeLinecap="round" />}
          {id === 3 && <><Circle cx="29" cy="27" r="7" fill={hairs[id]} /><Circle cx="40" cy="19" r="7" fill={hairs[id]} /><Circle cx="53" cy="18" r="7" fill={hairs[id]} /><Circle cx="66" cy="25" r="7" fill={hairs[id]} /><Circle cx="31" cy="53" r="2" fill="#F5CA6A" /><Circle cx="65" cy="53" r="2" fill="#F5CA6A" /></>}
        </>
      )}
    </Svg>
  );
}
