import { Popover, type Anchor } from './ui/Menu'

const EMOJIS = (
  '😀 😄 😁 😆 🥹 😅 😂 🙂 😉 😊 😍 🤩 😘 😎 🤓 🧐 🤔 🤗 🤫 😴 ' +
  '👋 👍 👎 👏 🙌 🤝 💪 🙏 ✌️ 🤞 ✍️ 💅 👀 🧠 ❤️ 🧡 💛 💚 💙 💜 ' +
  '⭐ 🌟 ✨ ⚡ 🔥 💥 ☀️ 🌙 🌈 ☁️ ❄️ 🌊 🌍 🌸 🌼 🌿 🍀 🌳 🍁 🍄 ' +
  '🍎 🍊 🍋 🍉 🍇 🍓 🥝 🍅 🥑 🥕 🌽 🍞 🧀 🍕 🍔 🍣 🍜 ☕ 🍵 🍷 ' +
  '⚽ 🏀 🏈 🎾 🏐 🎱 🏓 🎯 🎮 🎲 🎸 🎹 🎺 🎻 🥁 🎤 🎧 🎬 🎨 🎭 ' +
  '🚀 ✈️ 🚗 🚕 🚌 🚲 🛴 🚂 ⛵ 🚁 🏠 🏢 🏰 🗼 🗽 ⛺ 🌋 🗻 🏖️ 🏝️ ' +
  '💡 🔦 🕯️ 📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ ' +
  '💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ ' +
  '🔒 🔓 🔑 🗝️ 🔨 🪓 ⛏️ 🛠️ 🗡️ ⚔️ 🛡️ 🔧 🪛 🔩 ⚙️ ⚖️ 🔗 ⛓️ 🧲 🧪 ' +
  '🧬 🔬 🔭 📡 💉 💊 🩹 🩺 🚪 🛏️ 🛋️ 🪑 🚽 🧹 🧺 🧻 🧼 🪥 🧽 🧯 ' +
  '✅ ❌ ❓ ❗ 💯 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔶 🔷 🔸 🔹 🔺 🔻'
).split(' ')

export default function EmojiPicker({
  anchor,
  onClose,
  onPick,
  onRemove
}: {
  anchor: Anchor
  onClose: () => void
  onPick: (emoji: string) => void
  onRemove?: () => void
}): React.JSX.Element {
  return (
    <Popover anchor={anchor} onClose={onClose} width={340}>
      <div className="emoji-grid">
        {EMOJIS.map((e, i) => (
          <button
            key={i}
            onClick={() => {
              onPick(e)
              onClose()
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="emoji-picker-footer">
        <button
          className="btn"
          onClick={() => {
            onPick(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])
            onClose()
          }}
        >
          🎲 Random
        </button>
        {onRemove && (
          <button
            className="btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            Remove
          </button>
        )}
      </div>
    </Popover>
  )
}
