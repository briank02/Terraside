# Terraside

Terraside is a modern, high-performance desktop media and manga reader built to handle massive libraries with thousands of chapters effortlessly. Designed with the reader in mind, it provides a seamless and completely lag-free reading experience.

## Features

**📚 Library Management**
- **Sub-folder Structure Support**: Organize your collection easily. For example:
  ```text
  📁 Manga A
  ├── 📁 Volume 1
  │   ├── 📄 Chapter 1
  │   └── 📄 Chapter 2
  └── 📁 Volume 2
      └── 📄 Chapter 3
  ```
or,
  ```text
  📁 Manga Collection
  ├── 📁 Manga A
  │   └── 📁 Volume 1
  │       ├── 📄 Chapter 1
  │       └── 📄 Chapter 2
  │   └── 📁 Volume 2
  │       ├── 📄 Chapter 3
  │       └── 📄 Chapter 4
  └── 📁 Manga B
      └── 📄 Chapter 1
  ```
are all supported!
- **Customizable Views**: Switch effortlessly between Thumbnail view and List view based on your preference.
- **Sorting Options**: Sort your library by different criteria to find exactly what you're looking for.
- **Save Your Progress**: Automatically saves where you read up to, so you can pick up exactly where you left off.
- **Rating System**: Rate and keep track of your favorite series.

**📖 Reading Experience**
- **Preview Mode**: See all chapter pages at once to quickly glance at the chapter or find a specific scene.
- **Scroll & Flip Support**: Choose between continuous scrolling or traditional page flipping. Includes customizable scroll speed!
- **Reading Direction**: Full support for Right-to-Left (manga style) or Left-to-Right reading based on your preference.
- **Screen Layouts & Zooming**: Adjust the screen layout and zoom into pages for the perfect fit.
- **Quick Navigation**: Easily jump between chapters without interrupting your reading flow.

**🎨 Customization**
- **Light & Dark Mode**: Full support for light and dark themes to match your reading environment.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Development Mode
To run the application locally from source without building an installer:

```bash
# Install dependencies
npm install

# Start the application in development mode
npm run dev
```
*(Note: On Windows, you may need to run `cmd /c npm run dev` if your PowerShell execution policy restricts script execution).*

### Packaging & Installation
To package Terraside into a standalone Windows installer (`.exe`):

```bash
# Compile and build the installer
npm run build
```
*(Note: On Windows, use `cmd /c npm run build`).*

Once the build finishes, the packaged installer executable can be found in the `release/` directory. Double-click it to install Terraside on your PC.

## License
MIT
