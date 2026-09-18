import React, { useRef, useEffect } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Path, Rect, G, Ellipse } from "react-native-svg";
import { mascotColors } from "@/constants/theme";
import { StudyQuote } from "../../lib/data/studyQuotes";

export interface DynamicMomoHeadProps { quote: StudyQuote; }

export function DynamicMomoHead({ quote }: DynamicMomoHeadProps) {
  const transitionAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    transitionAnim.setValue(0.7);
    Animated.spring(transitionAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [quote.id]);

  return (
    <Animated.View
      style={[{
          transform: [
            { scale: transitionAnim },
          ],
        }
      ]}
    >
      {/* We adjust the viewBox to just focus on the head instead of the whole body */}
      <Svg width={92} height={92} viewBox="50 50 200 130">
        {/* Magic Background Sparkles */}
        <Circle
          cx="35"
          cy="55"
          r="7"
          fill={mascotColors.gold}
          opacity={quote.category === "manifesting" ? 0.95 : 0.8}
        />
        <Circle
          cx="265"
          cy="50"
          r="8"
          fill={mascotColors.goldLight}
          opacity={quote.category === "manifesting" ? 0.95 : 0.8}
        />
        <Circle
          cx="25"
          cy="225"
          r="6"
          fill={mascotColors.goldLight}
          opacity={0.75}
        />
        <Circle
          cx="270"
          cy="220"
          r="7"
          fill={mascotColors.gold}
          opacity={0.85}
        />

        {/* Big Rounded Monkey Ears */}
        <Circle cx="66" cy="136" r="34" fill={mascotColors.fur} />
        <Circle cx="69" cy="136" r="22" fill={mascotColors.peach} />
        <Circle cx="234" cy="136" r="34" fill={mascotColors.fur} />
        <Circle cx="231" cy="136" r="22" fill={mascotColors.peach} />

        {/* Cute Monkey Hair Tufts on Top */}
        <Path
          d="M 144 76 Q 148 54 150 56 Q 152 54 156 76"
          fill={mascotColors.fur}
        />
        <Circle cx="150" cy="62" r="7" fill={mascotColors.fur} />

        {/* Chibi Round Head */}
        <Circle cx="150" cy="138" r="68" fill={mascotColors.fur} />

        {/* Heart-Shaped Monkey Face Mask */}
        <Circle cx="122" cy="126" r="36" fill={mascotColors.face} />
        <Circle cx="178" cy="126" r="36" fill={mascotColors.face} />
        <Ellipse cx="150" cy="154" rx="46" ry="34" fill={mascotColors.face} />

        {/* Rosy Blush Cheeks & Cheek Accents (Reactive to quote) */}
        {quote.category === "real_talk" ? (
          <G>
            <Ellipse
              cx="106"
              cy="152"
              rx="15"
              ry="9"
              fill={mascotColors.blush}
              opacity={0.95}
            />
            <Ellipse
              cx="194"
              cy="152"
              rx="15"
              ry="9"
              fill={mascotColors.blush}
              opacity={0.95}
            />
            <Path
              d="M 102 150 L 105 154 M 106 150 L 109 154"
              stroke={mascotColors.blush}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <Path
              d="M 191 150 L 194 154 M 195 150 L 198 154"
              stroke={mascotColors.blush}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </G>
        ) : quote.category === "brain_gains" ? (
          <G>
            <Ellipse
              cx="106"
              cy="152"
              rx="15"
              ry="9"
              fill={mascotColors.pink}
              opacity={0.85}
            />
            <Ellipse
              cx="194"
              cy="152"
              rx="15"
              ry="9"
              fill={mascotColors.pink}
              opacity={0.85}
            />
            <Path
              d="M 101 150 L 104 154 M 106 150 L 109 154"
              stroke={mascotColors.white}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <Path
              d="M 191 150 L 194 154 M 196 150 L 199 154"
              stroke={mascotColors.white}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </G>
        ) : quote.category === "manifesting" ? (
          <G>
            <Ellipse
              cx="106"
              cy="152"
              rx="15"
              ry="10"
              fill={mascotColors.pink}
              opacity={0.8}
            />
            <Ellipse
              cx="194"
              cy="152"
              rx="15"
              ry="10"
              fill={mascotColors.pink}
              opacity={0.8}
            />
            <Path
              d="M 92 144 L 94 139 L 96 144 L 101 146 L 96 148 L 94 153 L 92 148 L 87 146 Z"
              fill={mascotColors.gold}
            />
            <Path
              d="M 204 144 L 206 139 L 208 144 L 213 146 L 208 148 L 206 153 L 204 148 L 199 146 Z"
              fill={mascotColors.gold}
            />
          </G>
        ) : quote.category === "dopamine_check" ? (
          <G>
            <Ellipse
              cx="106"
              cy="152"
              rx="14"
              ry="9"
              fill={mascotColors.pinkSoft}
              opacity={0.85}
            />
            <Ellipse
              cx="194"
              cy="152"
              rx="14"
              ry="9"
              fill={mascotColors.pinkSoft}
              opacity={0.85}
            />
          </G>
        ) : (
          <G>
            <Ellipse
              cx="106"
              cy="152"
              rx="14"
              ry="9"
              fill={mascotColors.blush}
              opacity={0.85}
            />
            <Ellipse
              cx="194"
              cy="152"
              rx="14"
              ry="9"
              fill={mascotColors.blush}
              opacity={0.85}
            />
          </G>
        )}

        {/* DISTINCTIVE MONKEY NOSTRILS (Two cute dark dots) */}
        <Circle cx="145" cy="146" r="3.2" fill={mascotColors.furDark} />
        <Circle cx="155" cy="146" r="3.2" fill={mascotColors.furDark} />

        {/* DYNAMIC MOUTH EXPRESSION (Changes with Quote) */}
        {quote.category === "real_talk" ? (
          /* Sassy Anime :3 Cat Smirk */
          <Path
            d="M 134 157 Q 142 165 150 159 Q 158 165 166 157"
            fill="none"
            stroke={mascotColors.furDark}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        ) : quote.category === "brain_gains" ? (
          /* Big Proud Toothy Open Grin */
          <G>
            <Path
              d="M 132 153 Q 150 178 168 153 Z"
              fill={mascotColors.pink}
              stroke={mascotColors.furDark}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            <Path
              d="M 136 154 Q 150 160 164 154"
              stroke={mascotColors.white}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <Path d="M 141 168 Q 150 161 159 168" fill={mascotColors.blush} />
          </G>
        ) : quote.category === "boss_energy" ? (
          /* Confident Boss Smirk Tucked at Corner */
          <G>
            <Path
              d="M 137 159 Q 148 164 163 154"
              fill="none"
              stroke={mascotColors.furDark}
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <Path
              d="M 163 154 L 166 151"
              fill="none"
              stroke={mascotColors.furDark}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </G>
        ) : quote.category === "lock_in" ? (
          /* Determined Resolute Smirk */
          <Path
            d="M 137 159 Q 150 167 163 159"
            fill="none"
            stroke={mascotColors.furDark}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        ) : quote.category === "scholar_era" ? (
          /* Studious Knowing Little Smile */
          <Path
            d="M 138 158 Q 150 167 162 158"
            fill="none"
            stroke={mascotColors.furDark}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ) : quote.category === "dopamine_check" ? (
          /* Calm Zen Gentle Smile */
          <Path
            d="M 139 157 Q 150 166 161 157"
            fill="none"
            stroke={mascotColors.furDark}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ) : (
          /* Cheerful Open Monkey Smile with Tongue (Default / Manifesting) */
          <G>
            <Path
              d="M 134 156 Q 150 174 166 156"
              fill={mascotColors.pink}
              stroke={mascotColors.furDark}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <Path
              d="M 142 166 Q 150 160 158 166 Q 150 173 142 166"
              fill={mascotColors.blush}
            />
          </G>
        )}

        {/* DYNAMIC EYES & ACCESSORIES (NO EYEBROWS, CHANGES WITH QUOTE) */}
        {quote.category === "real_talk" ? (
          /* Sassy Wink: Left eye wide puppy eye, Right eye playful wink with star */
          <G>
            {/* Left Eye */}
            <Ellipse
              cx="124"
              cy="132"
              rx="16"
              ry="21"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="124"
              cy="142"
              rx="10"
              ry="7"
              fill={mascotColors.brand}
              opacity={0.35}
            />
            <Circle cx="120" cy="125" r="6.4" fill={mascotColors.white} />
            <Circle cx="128" cy="139" r="3.4" fill={mascotColors.white} />
            <Circle
              cx="118"
              cy="135"
              r="1.8"
              fill={mascotColors.white}
              opacity={0.9}
            />

            {/* Right Eye: Playful Wink */}
            <Path
              d="M 162 134 Q 176 146 190 134"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth="4.8"
              strokeLinecap="round"
            />
            <Path
              d="M 189 133 L 196 128"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            {/* Sassy Sparkle */}
            <Path
              d="M 198 120 L 200 114 L 202 120 L 208 122 L 202 124 L 200 130 L 198 124 L 192 122 Z"
              fill={mascotColors.gold}
            />
          </G>
        ) : quote.category === "manifesting" ? (
          /* Manifesting: Radiant Golden Star Eyes */
          <G>
            {/* Left Eye */}
            <Ellipse
              cx="124"
              cy="132"
              rx="17"
              ry="22"
              fill={mascotColors.eyes}
            />
            <Path
              d="M 124 117 L 126.5 127 L 137 132 L 126.5 137 L 124 147 L 121.5 137 L 111 132 L 121.5 127 Z"
              fill={mascotColors.goldLight}
            />
            <Path
              d="M 124 125 L 125.5 130 L 130 132 L 125.5 134 L 124 139 L 122.5 134 L 118 132 L 122.5 130 Z"
              fill={mascotColors.white}
            />
            <Circle cx="118" cy="123" r="3.2" fill={mascotColors.white} />
            <Circle cx="130" cy="141" r="2.2" fill={mascotColors.white} />

            {/* Right Eye */}
            <Ellipse
              cx="176"
              cy="132"
              rx="17"
              ry="22"
              fill={mascotColors.eyes}
            />
            <Path
              d="M 176 117 L 178.5 127 L 189 132 L 178.5 137 L 176 147 L 173.5 137 L 163 132 L 173.5 127 Z"
              fill={mascotColors.goldLight}
            />
            <Path
              d="M 176 125 L 177.5 130 L 182 132 L 177.5 134 L 176 139 L 174.5 134 L 170 132 L 174.5 130 Z"
              fill={mascotColors.white}
            />
            <Circle cx="170" cy="123" r="3.2" fill={mascotColors.white} />
            <Circle cx="182" cy="141" r="2.2" fill={mascotColors.white} />
          </G>
        ) : quote.category === "scholar_era" ? (
          /* Scholar Era: Modal Glistening Eyes + Stylish Round Scholar Spectacles */
          <G>
            {/* Left Eye */}
            <Ellipse
              cx="124"
              cy="132"
              rx="16"
              ry="21"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="124"
              cy="142"
              rx="10"
              ry="7"
              fill={mascotColors.brand}
              opacity={0.35}
            />
            <Circle cx="120" cy="125" r="6.4" fill={mascotColors.white} />
            <Circle cx="128" cy="139" r="3.4" fill={mascotColors.white} />
            <Circle
              cx="118"
              cy="135"
              r="1.8"
              fill={mascotColors.white}
              opacity={0.9}
            />

            {/* Right Eye */}
            <Ellipse
              cx="176"
              cy="132"
              rx="16"
              ry="21"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="176"
              cy="142"
              rx="10"
              ry="7"
              fill={mascotColors.brand}
              opacity={0.35}
            />
            <Circle cx="172" cy="125" r="6.4" fill={mascotColors.white} />
            <Circle cx="180" cy="139" r="3.4" fill={mascotColors.white} />
            <Circle
              cx="170"
              cy="135"
              r="1.8"
              fill={mascotColors.white}
              opacity={0.9}
            />

            {/* Cute Gold Scholar Spectacles */}
            <Circle
              cx="124"
              cy="132"
              r="23"
              fill={mascotColors.white}
              fillOpacity={0.12}
              stroke={mascotColors.gold}
              strokeWidth={3.2}
            />
            <Path
              d="M 112 119 L 122 114"
              stroke={mascotColors.white}
              strokeWidth={2.8}
              strokeLinecap="round"
              opacity={0.85}
            />
            <Circle
              cx="176"
              cy="132"
              r="23"
              fill={mascotColors.white}
              fillOpacity={0.12}
              stroke={mascotColors.gold}
              strokeWidth={3.2}
            />
            <Path
              d="M 164 119 L 174 114"
              stroke={mascotColors.white}
              strokeWidth={2.8}
              strokeLinecap="round"
              opacity={0.85}
            />
            <Path
              d="M 147 131 Q 150 126 153 131"
              fill="none"
              stroke={mascotColors.gold}
              strokeWidth={3.2}
              strokeLinecap="round"
            />
            <Path
              d="M 101 131 L 87 128"
              fill="none"
              stroke={mascotColors.gold}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Path
              d="M 199 131 L 213 128"
              fill="none"
              stroke={mascotColors.gold}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </G>
        ) : quote.category === "brain_gains" ? (
          /* Brain Gains: Ecstatic ^ ^ Happy Closed Crescent Curves */
          <G>
            <Path
              d="M 108 136 Q 124 118 140 136"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth={4.8}
              strokeLinecap="round"
            />
            <Path
              d="M 115 142 Q 124 146 133 142"
              fill="none"
              stroke={mascotColors.blush}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            <Path
              d="M 160 136 Q 176 118 192 136"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth={4.8}
              strokeLinecap="round"
            />
            <Path
              d="M 167 142 Q 176 146 185 142"
              fill="none"
              stroke={mascotColors.blush}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
            {/* Spark of Genius */}
            <Path
              d="M 150 48 L 152 42 L 154 48 L 160 50 L 154 52 L 152 58 L 150 52 L 144 50 Z"
              fill={mascotColors.goldLight}
            />
          </G>
        ) : quote.category === "boss_energy" ? (
          /* Boss Energy: Stylish Boss Shades with Lens Streaks & Glint */
          <G>
            {/* Left Lens */}
            <Path
              d="M 104 122 Q 124 116 145 122 L 143 145 Q 124 151 107 144 Z"
              fill={mascotColors.eyes}
              stroke={mascotColors.brandDark}
              strokeWidth={2.5}
            />
            {/* Right Lens */}
            <Path
              d="M 155 122 Q 176 116 196 122 L 193 144 Q 176 151 157 145 Z"
              fill={mascotColors.eyes}
              stroke={mascotColors.brandDark}
              strokeWidth={2.5}
            />
            {/* Bridge */}
            <Path
              d="M 144 126 Q 150 122 156 126"
              stroke={mascotColors.eyes}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
            {/* Lens Reflection Streaks */}
            <Path
              d="M 112 125 L 126 139"
              stroke={mascotColors.white}
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0.9}
            />
            <Path
              d="M 121 125 L 133 137"
              stroke={mascotColors.white}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.6}
            />
            <Path
              d="M 163 125 L 177 139"
              stroke={mascotColors.white}
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0.9}
            />
            <Path
              d="M 172 125 L 184 137"
              stroke={mascotColors.white}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.6}
            />
            {/* Star Glint */}
            <Path
              d="M 197 122 L 199 116 L 201 122 L 207 124 L 201 126 L 199 132 L 197 126 L 191 124 Z"
              fill={mascotColors.goldLight}
            />
          </G>
        ) : quote.category === "dopamine_check" ? (
          /* Dopamine Check: Peaceful Serene u u Arches */
          <G>
            <Path
              d="M 110 128 Q 124 143 138 128"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Path
              d="M 162 128 Q 176 143 190 128"
              fill="none"
              stroke={mascotColors.eyes}
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Circle
              cx="98"
              cy="136"
              r={3}
              fill={mascotColors.greenSoft}
              opacity={0.75}
            />
            <Circle
              cx="202"
              cy="136"
              r={3}
              fill={mascotColors.greenSoft}
              opacity={0.75}
            />
          </G>
        ) : quote.category === "lock_in" ? (
          /* Lock In: Laser Focus Glistening Eyes with Cyan Spark & Effort Sweat Drop */
          <G>
            {/* Left Eye */}
            <Ellipse
              cx="124"
              cy="132"
              rx="15"
              ry="19"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="124"
              cy="141"
              rx="9"
              ry="6"
              fill={mascotColors.brand}
              opacity={0.45}
            />
            <Circle cx="121" cy="125" r={5.6} fill={mascotColors.white} />
            <Circle cx="128" cy="138" r={3.0} fill={mascotColors.white} />
            <Circle cx="118" cy="132" r={1.8} fill={mascotColors.tear} />

            {/* Right Eye */}
            <Ellipse
              cx="176"
              cy="132"
              rx="15"
              ry="19"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="176"
              cy="141"
              rx="9"
              ry="6"
              fill={mascotColors.brand}
              opacity={0.45}
            />
            <Circle cx="173" cy="125" r={5.6} fill={mascotColors.white} />
            <Circle cx="180" cy="138" r={3.0} fill={mascotColors.white} />
            <Circle cx="170" cy="132" r={1.8} fill={mascotColors.tear} />

            {/* Focus Effort Sweat Drop on Temple */}
            <Path
              d="M 194 116 C 197 110, 203 118, 199 124 C 196 128, 191 126, 191 122 C 191 119, 193 117, 194 116 Z"
              fill={mascotColors.tear}
              opacity={0.9}
            />
            <Circle cx="196" cy="119" r={1.2} fill={mascotColors.white} />
          </G>
        ) : (
          /* Default: Full Modal Glistening Eyes (Puppy catchlights, zero eyebrows) */
          <G>
            {/* Left Eye */}
            <Ellipse
              cx="124"
              cy="132"
              rx="16"
              ry="21"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="124"
              cy="142"
              rx="10"
              ry="7"
              fill={mascotColors.brand}
              opacity={0.35}
            />
            <Circle cx="120" cy="125" r={6.4} fill={mascotColors.white} />
            <Circle cx="128" cy="139" r={3.4} fill={mascotColors.white} />
            <Circle
              cx="118"
              cy="135"
              r={1.8}
              fill={mascotColors.white}
              opacity={0.9}
            />

            {/* Right Eye */}
            <Ellipse
              cx="176"
              cy="132"
              rx="16"
              ry="21"
              fill={mascotColors.eyes}
            />
            <Ellipse
              cx="176"
              cy="142"
              rx="10"
              ry="7"
              fill={mascotColors.brand}
              opacity={0.35}
            />
            <Circle cx="172" cy="125" r={6.4} fill={mascotColors.white} />
            <Circle cx="180" cy="139" r={3.4} fill={mascotColors.white} />
            <Circle
              cx="170"
              cy="135"
              r={1.8}
              fill={mascotColors.white}
              opacity={0.9}
            />
          </G>
        )}

        {/* Study Book with Yellow Banana Bookmark */}
        <Rect
          x="118"
          y="212"
          width="64"
          height="36"
          rx="6"
          fill={mascotColors.brand}
        />
        <Rect
          x="122"
          y="214"
          width="26"
          height="32"
          rx="3"
          fill={mascotColors.white}
        />
        <Rect
          x="152"
          y="214"
          width="26"
          height="32"
          rx="3"
          fill={mascotColors.white}
        />
        {/* Banana Bookmark poking out */}
        <Path
          d="M 152 205 Q 160 207 162 215 Q 156 213 150 209 Z"
          fill={mascotColors.goldLight}
        />
        {/* Paws on book */}
        <Circle cx="120" cy="226" r="10" fill={mascotColors.peach} />
        <Circle cx="180" cy="226" r="10" fill={mascotColors.peach} />
        <Circle cx="150" cy="228" r="4.5" fill={mascotColors.gold} />

        {/* Scholar Mortarboard Cap */}
        <G transform="rotate(-5 150 78)">
          <Rect
            x="128"
            y="76"
            width="44"
            height="14"
            rx="4"
            fill={mascotColors.brandDark}
          />
          {/* Diamond top */}
          <Path
            d="M 150 56 L 196 74 L 150 92 L 104 74 Z"
            fill={mascotColors.brandDeep}
          />
          <Circle cx="150" cy="74" r="5" fill={mascotColors.gold} />
          {/* Gold Tassel */}
          <Path
            d="M 150 74 Q 170 82 178 92"
            fill="none"
            stroke={mascotColors.gold}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <Circle cx="178" cy="94" r="4" fill={mascotColors.gold} />
          <Rect
            x="176"
            y="96"
            width="5"
            height="10"
            rx="2"
            fill={mascotColors.gold}
          />
        </G>
      </Svg>
    </Animated.View>
  );
}
