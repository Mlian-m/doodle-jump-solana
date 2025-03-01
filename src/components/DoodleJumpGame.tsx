import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';

interface DoodleJumpGameProps {
  onScoreUpdate: (score: number) => void;
}

// Create a single game instance that persists across renders
let gameInstance: Phaser.Game | null = null;
let gameScene: Phaser.Scene | null = null;
let isGameInitialized = false;

const DoodleJumpGame: React.FC<DoodleJumpGameProps> = ({ onScoreUpdate }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
  };

  const restartGame = () => {
    setGameOver(false);
    if (gameScene) {
      // Reset the scene instead of recreating the game
      gameScene.scene.restart();
    }
  };

  useEffect(() => {
    // Only initialize once and only when the user has clicked start
    if (!gameStarted || isGameInitialized) return;

    class DoodleJumpScene extends Phaser.Scene {
      private platforms?: Phaser.Physics.Arcade.Group;
      private player?: Phaser.Physics.Arcade.Sprite;
      private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
      private score = 0;
      private scoreText?: Phaser.GameObjects.Text;
      private highestY = 0;
      private isGameOver = false;
      private enemies?: Phaser.Physics.Arcade.Group;
      private canvasWidth = 0;
      private canvasHeight = 0;

      constructor() {
        super({ key: 'DoodleJumpScene' });
      }

      preload() {
        // Use a rectangular image for platforms that will look more like paper rolls when rotated
        this.load.image('platform-cylinder', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/block.png');
        
        // Keep the player image
        this.load.image('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
        
        // Load special items
        this.load.image('spring', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/spring.png');
        this.load.image('jetpack', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/jet.png');
      }

      create() {
        // Store this scene for external access
        gameScene = this;
        
        // Reset game state variables
        this.score = 0;
        this.isGameOver = false;
        
        // Get the actual canvas dimensions and store them in class properties
        this.canvasWidth = this.sys.game.canvas.width;
        this.canvasHeight = this.sys.game.canvas.height;
        
        // Reset camera to top
        this.cameras.main.scrollY = 0;
        
        // Configure world bounds using class properties
        this.physics.world.setBounds(0, -10000, this.canvasWidth, 20000);
        
        // Setup platform types - IMPORTANT: Don't use StaticGroup for moving platforms
        this.platforms = this.physics.add.group(); // Use regular group for dynamic behavior
        
        // Create initial platforms
        if (this.platforms) {
          // Start with a paper roll platform at the bottom
          const basePlatform = this.platforms.create(200, 550, 'platform-cylinder');
          basePlatform.setAngle(90); // Rotate to horizontal
          basePlatform.setScale(0.4, 1.2); // Much larger base platform
          basePlatform.setData('type', 'regular');
          basePlatform.setImmovable(true);
          basePlatform.setTint(0xDDDDDD); // Light gray like paper
          
          // Create initial platforms
          for (let i = 0; i < 10; i++) {
            const variance = Math.sin(i * 0.5) * 150;
            const x = 200 + variance;
            const y = 500 - (i * 80);
            
            // Platform type logic
            let platformType = 'regular';
            if (i > 3) {
              const rnd = Math.random();
              if (rnd < 0.25) platformType = 'moving';
              else if (rnd < 0.4) platformType = 'breakable';
            }
            
            this.createPlatform(x, y, platformType);
          }
        }
        
        // Player character setup
        this.player = this.physics.add.sprite(200, 500, 'player');
        this.player.setBounce(0);
        this.player.setCollideWorldBounds(true);
        
        // Initial upward velocity
        this.player.setVelocityY(-400);
        
        // CRITICAL: Initialize highestY to player's starting position
        this.highestY = this.player.y;
        
        // Collision handler
        if (this.player && this.platforms) {
          this.physics.add.collider(
            this.player,
            this.platforms,
            (player, platform) => {
              // Cast to proper types
              const p = player as Phaser.Physics.Arcade.Sprite;
              const plat = platform as Phaser.Physics.Arcade.Sprite;
              
              // Apply bounce and handle platform effects
              if (p.body && p.body.velocity.y > 0) {
                // Regular platforms bounce normally
                const platformType = plat.getData('type');
                
                // Vary bounce height slightly based on platform type
                if (platformType === 'moving') {
                  p.setVelocityY(-650); // Moving platforms give a bit higher bounce
                } else {
                  p.setVelocityY(-600); // Standard bounce
                }
                
                // Visual feedback - different colors for different platforms
                if (platformType === 'regular') {
                  plat.setTintFill(0x00FF00);
                } else if (platformType === 'moving') {
                  plat.setTintFill(0x00AAFF);
                } else if (platformType === 'breakable') {
                  plat.setTintFill(0xFFAA00);
                }
                
                this.time.delayedCall(100, () => {
                  plat.clearTint();
                });
                
                // Handle special platform types
                if (platformType === 'breakable') {
                  // Breakable platforms disappear after one bounce
                  this.tweens.add({
                    targets: plat,
                    alpha: 0,
                    y: plat.y + 20, 
                    duration: 200,
                    onComplete: () => plat.destroy()
                  });
                }
              }
            },
            (player, platform) => {
              // Only allow collisions when player is falling onto platform top
              const p = player as Phaser.Physics.Arcade.Sprite;
              return p.body && p.body.velocity.y > 0;
            }
          );
        }
        
        // Setup controls
        this.cursors = this.input.keyboard?.createCursorKeys();
        
        // Score display
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
          fontSize: '24px',
          color: '#fff',
          stroke: '#000',
          strokeThickness: 3
        }).setScrollFactor(0);
        
        // Screen wrapping
        if (this.player.x < 0) {
          this.player.x = this.canvasWidth;
        } else if (this.player.x > this.canvasWidth) {
          this.player.x = 0;
        }
        
        // Platform positioning
        // Change all instances of hardcoded values (like 200, 350, etc.) to be relative to width
        const centerX = this.canvasWidth / 2;
        const edgeDistance = this.canvasWidth * 0.1; // 10% from edge
        
        // Update platform creation to use relative positioning
        let x;
        if (Math.random() < 0.4) {
          x = Math.random() < 0.5 ? 
            Phaser.Math.Between(edgeDistance, this.canvasWidth * 0.25) : // Left edge
            Phaser.Math.Between(this.canvasWidth * 0.75, this.canvasWidth - edgeDistance); // Right edge
        } else {
          x = Phaser.Math.Between(this.canvasWidth * 0.2, this.canvasWidth * 0.8);
        }
      }
      
      update(time: number, delta: number) {
        if (!this.player || !this.cursors || !this.platforms || !this.scoreText || this.isGameOver) return;
        
        // Track camera's current position
        const currentCameraY = this.cameras.main.scrollY;
        
        // Move camera only if player is higher than camera's current view
        const CAMERA_OFFSET = 150;
        
        if (this.player.y < currentCameraY + CAMERA_OFFSET) {
          // Only move camera up, never down
          this.cameras.main.scrollY = this.player.y - CAMERA_OFFSET;
        }
        
        // Update score based on highest point reached (separate from camera movement)
        if (this.player.y < this.highestY) {
          this.highestY = this.player.y;
          // Calculate score based on how high player has climbed from starting position
          this.score = Math.floor(Math.abs(this.highestY - 500) / 10);
          this.scoreText.setText(`Score: ${this.score}`);
          onScoreUpdate(this.score);
        }
        
        // Update moving platforms
        this.platforms.getChildren().forEach((child: any) => {
          const platform = child as Phaser.Physics.Arcade.Sprite;
          
          if (platform.getData('type') === 'moving') {
            const direction = platform.getData('direction') || 1;
            const speed = platform.getData('speed') || 100;
            
            // Move platform horizontally
            platform.x += direction * (speed * delta / 1000);
            
            // Change direction at edges
            if (platform.x < 50) {
              platform.setData('direction', 1);
            } else if (platform.x > this.canvasWidth - 50) { // Use canvasWidth
              platform.setData('direction', -1);
            }
          }
        });
        
        // Player horizontal movement
        if (this.cursors.left.isDown) {
          this.player.setVelocityX(-300);
          this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
          this.player.setVelocityX(300);
          this.player.setFlipX(false);
        } else {
          this.player.setVelocityX(0);
        }
        
        // Wrap player around screen edges
        if (this.player.x < 0) {
          this.player.x = this.canvasWidth;
        } else if (this.player.x > this.canvasWidth) {
          this.player.x = 0;
        }
        
        // Game over when falling too far below camera view
        // This creates the "falling into the void" effect
        const FALL_THRESHOLD = 600; // How far below camera view player can fall before game over
        if (this.player.y > this.cameras.main.scrollY + this.canvasHeight + 100) { 
          this.gameOver();
        }
        
        // Generate new platforms as player moves up
        this.generatePlatforms();
        this.cleanupPlatforms();
      }

      // Create platform with specified type
      createPlatform(x: number, y: number, type: string = 'regular') {
        if (!this.platforms) return null;
        
        // Create platform with the block image
        const platform = this.platforms.create(x, y, 'platform-cylinder');
        
        // Set the platform to be horizontal
        platform.setAngle(90);
        
        // Make platforms much larger and more visible
        let lengthScale;
        if (type === 'regular') {
          lengthScale = Phaser.Math.FloatBetween(0.8, 1.2); // Much longer for regular
        } else if (type === 'moving') {
          lengthScale = Phaser.Math.FloatBetween(0.7, 1.0); // Medium for moving
        } else {
          lengthScale = Phaser.Math.FloatBetween(0.6, 0.9); // Shorter for breakable
        }
        
        // Increase both width and height significantly
        platform.setScale(0.4, lengthScale);
        
        platform.setData('type', type);
        platform.setImmovable(true);
        
        // Use very distinct colors to ensure visibility
        if (type === 'moving') {
          platform.setTint(0x66AAFF); // Bright blue for moving
        } else if (type === 'breakable') {
          platform.setTint(0xFFAA66); // Bright orange for breakable
        } else {
          platform.setTint(0xDDDDDD); // Light gray for regular paper
        }
        
        return platform;
      }

      // New method to add special items to platforms
      addSpecialItem(platform: Phaser.Physics.Arcade.Sprite) {
        const itemType = Math.random() < 0.7 ? 'spring' : 'jetpack';
        
        // Create the item
        const item = this.physics.add.sprite(platform.x, platform.y - 15, itemType);
        item.setData('type', itemType);
        
        // Scale item appropriately
        if (itemType === 'spring') {
          item.setScale(0.2);
        } else {
          item.setScale(0.15);
        }
        
        // Add collision with player
        if (this.player) {
          this.physics.add.overlap(
            this.player,
            item,
            (player, specialItem) => {
              // Cast to proper types
              const p = player as Phaser.Physics.Arcade.Sprite;
              const item = specialItem as Phaser.Physics.Arcade.Sprite;
              
              // Handle different item types
              if (item.getData('type') === 'spring') {
                // Springs give a super high jump
                p.setVelocityY(-900);
                
                // Visual feedback
                this.tweens.add({
                  targets: item,
                  scaleY: 0.3,
                  duration: 100,
                  yoyo: true
                });
              } else if (item.getData('type') === 'jetpack') {
                // Jetpacks give a massive boost upward
                p.setVelocityY(-1500);
                
                // Remove the jetpack after use
                item.destroy();
              }
            }
          );
        }
      }

      // Clean up platforms that are off-screen
      cleanupPlatforms() {
        if (!this.platforms) return;
        
        // Remove platforms that are far below the camera view
        const cameraBottom = this.cameras.main.scrollY + this.canvasHeight;
        
        this.platforms.getChildren().forEach((child: any) => {
          if (child.y > cameraBottom + 300) { // Clean up platforms well below view
            child.destroy();
          }
        });
      }

      // Generate new platforms as needed
      generatePlatforms() {
        if (!this.platforms || !this.player) return;
        
        // Find the highest platform
        let highestY = Number.MAX_SAFE_INTEGER;
        this.platforms.getChildren().forEach((child: any) => {
          if (child.y < highestY) {
            highestY = child.y;
          }
        });
        
        // Generate new platforms if needed
        if (highestY > this.player.y - 300) {
          // Ensure minimum number of platforms regardless of score
          const PLATFORM_COUNT = Math.max(3, 5 - Math.floor(this.score / 300));
          
          // Keep track of the last platform position to ensure reachability
          let lastX = this.player.x;
          let lastY = highestY;
          
          for (let i = 0; i < PLATFORM_COUNT; i++) {
            // Calculate gap based on score, but with a reasonable minimum and maximum
            const minGap = Math.min(150, 80 + this.score / 20); 
            const maxGap = Math.min(250, 120 + this.score / 10);
            
            const gap = Phaser.Math.Between(minGap, maxGap);
            const y = lastY - gap;
            
            // Calculate x position to ensure it's reachable from the last platform
            // Maximum horizontal distance a player can cover in one jump
            const MAX_HORIZONTAL_REACH = 200;
            
            let x;
            if (i === 0) {
              // First platform should be reachable from player's current position
              x = Phaser.Math.Between(
                Math.max(50, this.player.x - 150),
                Math.min(this.canvasWidth - 50, this.player.x + 150)
              );
            } else {
              // Subsequent platforms should be reachable from previous platform
              x = Phaser.Math.Between(
                Math.max(50, lastX - MAX_HORIZONTAL_REACH),
                Math.min(this.canvasWidth - 50, lastX + MAX_HORIZONTAL_REACH)
              );
            }
            
            // Ensure at least one platform is regular and easy to reach
            let type = 'regular';
            if (i > 0 || this.score < 50) { // Keep first platform regular for lower scores
              const rnd = Math.random();
              
              if (this.score > 100) {
                if (rnd < 0.3) type = 'moving';
                else if (rnd < 0.5) type = 'breakable';
              } else if (this.score > 50) {
                if (rnd < 0.2) type = 'moving';
                else if (rnd < 0.3) type = 'breakable';
              } else {
                if (rnd < 0.1) type = 'moving';
                else if (rnd < 0.15) type = 'breakable';
              }
            }
            
            // Create the platform
            const platform = this.createPlatform(x, y, type);
            
            // Remember this platform's position for next iteration
            lastX = x;
            lastY = y;
          }
        }
      }

      // Game over function
      gameOver() {
        if (this.isGameOver) return;
        
        this.isGameOver = true;
        setGameOver(true);
        
        // Player falls off the bottom
        if (this.player) {
          this.player.setTint(0xff0000);
          this.player.setVelocityY(500); // Fall faster for effect
        }
        
        // Game over text
        this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2,
          'Game Over',
          { 
            fontSize: '40px',
            color: '#fff',
            stroke: '#000',
            strokeThickness: 6
          }
        ).setOrigin(0.5).setScrollFactor(0);
        
        // Show score
        this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2 + 50,
          `Score: ${this.score}`,
          { 
            fontSize: '30px',
            color: '#fff',
            stroke: '#000',
            strokeThickness: 4
          }
        ).setOrigin(0.5).setScrollFactor(0);
      }
    }

    // Only create the game if it doesn't exist
    if (!gameInstance && gameContainerRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.CANVAS,
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: '100%',
          height: '100%',
          parent: gameContainerRef.current,
        },
        backgroundColor: '#87CEEB',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 1000 },
            debug: false
          }
        },
        scene: [DoodleJumpScene]
      };

      console.log("Creating new Phaser game instance");
      gameInstance = new Phaser.Game(config);
      isGameInitialized = true;
    }

    // Cleanup function
    return () => {
      // Don't destroy the game on component unmount to prevent flickering
      // We'll handle cleanup elsewhere if needed
    };
  }, [gameStarted, onScoreUpdate]);

  if (!gameStarted) {
    return (
      <div className="rounded-lg bg-gradient-to-b from-blue-400 to-blue-600 flex flex-col items-center justify-center" 
           style={{ width: '100%', aspectRatio: '2/3', maxWidth: '600px', margin: '0 auto' }}>
        <h2 className="text-white text-3xl font-bold mb-8 text-center">Doodle Jump</h2>
        <p className="text-white text-lg mb-8 text-center">Use arrow keys to move left and right</p>
        <button 
          onClick={startGame}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-xl transition-all"
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%',  // Use 100% width instead of fixed 400px
      aspectRatio: '2/3', // Maintain aspect ratio (or use fixed height if preferred)
      maxWidth: '600px', // Optional: prevent getting too wide on large screens
      margin: '0 auto' 
    }}>
      <div ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {gameOver && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <button 
            onClick={restartGame}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-xl mt-32"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default DoodleJumpGame; 