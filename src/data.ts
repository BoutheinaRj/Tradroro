import type { CategoryMap } from "./types"

// Demo data: 6 categories of voice commands with simulated responses
export const DATA: CategoryMap = {
  desktop: {
    name: "Desktop Control",
    icon: "🖥️",
    items: [
      { cmd: "Open Visual Studio Code", res: "🚀 Visual Studio Code is starting..." },
      { cmd: "Open Chrome", res: "🌐 Chrome is opening..." },
      { cmd: "Open Edge", res: "🌐 Edge is opening..." },
      { cmd: "Open Notepad", res: "📝 Notepad is opening..." },
      { cmd: "Open Calculator", res: "🧮 Calculator is opening..." },
      { cmd: "Open File Explorer", res: "📂 File Explorer is opening..." },
      { cmd: "Open Settings", res: "⚙️ Settings is opening..." },
      { cmd: "Close Chrome", res: "❎ Chrome closed." },
      { cmd: "Close Edge", res: "❎ Edge closed." },
      { cmd: "Close Visual Studio Code", res: "❎ VS Code closed." },
      { cmd: "Close Notepad", res: "❎ Notepad closed." },
      { cmd: "Minimize all windows", res: "🪟 All windows minimized." },
      { cmd: "Restore all windows", res: "🪟 Windows restored." },
      { cmd: "Mute volume", res: "🔇 Mute/unmute toggled." },
      { cmd: "Increase volume", res: "🔊 Volume increased." },
      { cmd: "Decrease volume", res: "🔉 Volume decreased." },
      { cmd: "Set brightness to 80%", res: "☀️ Brightness set to 80%." },
      { cmd: "Set brightness to 30%", res: "☀️ Brightness set to 30%." },
      { cmd: "Lock my screen", res: "🔒 Screen locked. See you soon!" },
      { cmd: "Put the PC to sleep", res: "💤 Going to sleep..." },
      { cmd: "Open the desktop", res: "📂 Desktop opened." },
      { cmd: "Create a folder Project Nova on the desktop", res: "📁 Folder 'Project Nova' created on the desktop ✅" },
      { cmd: "Create a test.txt file with text", res: "📝 File 'test.txt' created successfully on the desktop ✅" },
    ],
  },

  dev: {
    name: "Developer Assistant",
    icon: "💻",
    items: [
      { cmd: "Explain this function", res: "🧩 This function sorts a list and then returns the median..." },
      { cmd: "Fix this error", res: "🛠️ Out-of-bounds index error. Add a guard. Fixed ✅" },
      { cmd: "Create an authentication function", res: "📝 login() function with JWT generated and ready to integrate." },
      { cmd: "Make a commit with a clean message", res: "✅ Commit: 'feat: add authentication'." },
    ],
  },

  prod: {
    name: "Productivity",
    icon: "✅",
    items: [
      { cmd: "Add a task: finish the dashboard", res: "📝 Task added: 'Finish the dashboard'." },
      { cmd: "Remind me in 30 minutes to take a break", res: "⏰ Reminder scheduled in 30 minutes." },
      { cmd: "Start a 50-minute focus session", res: "🎯 50-minute focus mode activated. Stay focused!" },
      { cmd: "What are my appointments today?", res: "🗓️ 10am meeting, 2pm advisor check-in, 4pm review." },
    ],
  },

  comm: {
    name: "Communication",
    icon: "💬",
    items: [
      { cmd: "Read my new emails", res: "📨 3 new emails, including 1 from your advisor." },
      { cmd: "Summarize this email", res: "📄 Summary: progress report due Friday." },
      { cmd: "What are the important mentions on Slack?", res: "💬 2 mentions in #project-nova and #data." },
      { cmd: "Summarize the meeting from earlier", res: "📝 3 decisions, 2 actions: prepare the demo, deliver Tuesday." },
    ],
  },

  auto: {
    name: "Automation",
    icon: "⚙️",
    items: [
      { cmd: "Automate project backups every evening", res: "⚙️ Automatic backup scheduled every evening at 8 PM." },
      { cmd: "Send me a report every Friday", res: "📊 Weekly report scheduled for Friday at 5 PM." },
      { cmd: "Create a script to rename my files", res: "📜 Rename script generated." },
      { cmd: "Sign in to Notion and add this page", res: "🔗 Connected to Notion, page added." },
    ],
  },

  comp: {
    name: "Personal Companion",
    icon: "❤️",
    items: [
      { cmd: "How are you today?", res: "😊 I'm doing great! Ready for a productive day?" },
      { cmd: "Motivation to finish this project!", res: "💪 You're so close to the finish line, I believe in you 🚀" },
      { cmd: "Tell me a joke", res: "😄 Why do developers hate nature? Too many bugs!" },
      { cmd: "Relax mode", res: "🌊 Relax mode activated. Soft light, breathe..." },
    ],
  },
}

/** Find a response matching the typed text across all categories. */
export function findReply(text: string): string {
  const low = text.toLowerCase()
  const all = Object.values(DATA).flatMap((c) => c.items)
  const match = all.find((i) => low.includes(i.cmd.toLowerCase().slice(0, 12)))
  return match
    ? match.res
    : "🤖 Got it! (Full version: I analyze first, then act automatically.)"
}