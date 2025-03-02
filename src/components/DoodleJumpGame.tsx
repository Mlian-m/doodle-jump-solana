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
      
      // Make sure the onScoreUpdate callback is properly set for the new scene
      const scene = gameScene.scene.get('DoodleJumpScene');
      if (scene && scene.events) {
        // Add a custom event listener for score updates
        scene.events.once('create', () => {
          console.log('Scene restarted, reconnecting score update');
        });
      }
    }
  };

  useEffect(() => {
    // Only initialize once and only when the user has clicked start
    if (!gameStarted || isGameInitialized) return;

    class DoodleJumpScene extends Phaser.Scene {
      private platforms?: Phaser.Physics.Arcade.Group;
      private player?: Phaser.Physics.Arcade.Sprite;
      private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
      private keys: { [key: string]: Phaser.Input.Keyboard.Key | undefined } = {};
      private score = 0;
      private scoreText?: Phaser.GameObjects.Text;
      private highestY = 0;
      private isGameOver = false;
      private enemies?: Phaser.Physics.Arcade.Group;
      private clouds?: Phaser.GameObjects.Group;
      private lastMilestone = 0; // Track the last milestone reached
      private boostItems?: Phaser.Physics.Arcade.Group; // Group for boost items
      private lastBoostSpawn = 0; // Track when we last spawned a boost
      private boostActive = false; // Track if a boost is currently active
      private boostCollected = false; // Track if the current milestone's boost has been collected
      private miniBoostAvailable = true; // Track if mini-boost is available
      private miniBoostCooldown = 500; // Cooldown in ms

        constructor() {
        super({ key: 'DoodleJumpScene' });
        }

        preload() {
          // Load custom platform image instead of the default one
          this.load.image('platform', '/assets/platforms/platform1.png');
          
          // Keep the hedgy character images
          this.load.image('hedgy1', '/assets/charachter/hedgy1.png');
          this.load.image('hedgy2', '/assets/charachter/hedgy2.png');
          
          // Keep the fallback in case the images still don't load
          this.load.on('loaderror', (fileObj: any) => {
            console.log('Error loading:', fileObj.key);
            
            // If hedgy images fail to load, use a placeholder
            if (fileObj.key === 'hedgy1' || fileObj.key === 'hedgy2') {
              this.load.image(fileObj.key, 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
              this.load.start(); // Restart loader for this asset
            }
            
            // If platform image fails to load, use the default one
            if (fileObj.key === 'platform') {
              this.load.image(fileObj.key, 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/platform.png');
              this.load.start(); // Restart loader for this asset
            }
          });
          
          // For platform types, use the same custom platform image with different tints
          this.load.image('platform-default', '/assets/platforms/platform1.png');
          this.load.image('platform-moving', '/assets/platforms/platform1.png');
          this.load.image('platform-breakable', '/assets/platforms/platform1.png');
          this.load.image('platform-disappearing', '/assets/platforms/platform1.png');
          this.load.image('monster', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
          
          // Cloud images - make sure these exist
          this.load.image('cloud1', '/assets/clouds/cloud1.png');
          this.load.image('cloud2', '/assets/clouds/cloud2.png');
          this.load.image('cloud3', '/assets/clouds/cloud3.png');
          
          // Fallback for cloud images
          this.load.on('loaderror', (fileObj: any) => {
            if (fileObj.key.startsWith('cloud')) {
              this.load.image(fileObj.key, 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/cloud.png');
              this.load.start(); // Restart loader for this asset
            }
          });
          
          // Load the boost item image
          this.load.image('boost-item', '/assets/bonus/paper-roll.png');
          
          // Load fart animation sprite
          this.load.image('fart', '/assets/effects/fart.png');
        }

        create() {
        // Store this scene for external access
        gameScene = this;
        
        // Reset state
        this.isGameOver = false;
        this.score = 0;
        this.highestY = 0;
        this.lastMilestone = 0; // Reset the milestone tracker on restart
        
        // Explicitly call onScoreUpdate with the initial score
        onScoreUpdate(0);
        
        // Set sky color
        this.cameras.main.setBackgroundColor('#87CEEB');
        
        // Create cloud group
        this.clouds = this.add.group();
        
        // Create initial clouds at different depths
        for (let i = 0; i < 15; i++) {
          this.createCloud();
        }
        
        // Configure world bounds to be very tall and wider
        this.physics.world.setBounds(0, -10000, 800, 20000);
        
        // Setup platform types - IMPORTANT: Don't use StaticGroup for moving platforms
        this.platforms = this.physics.add.group(); // Use regular group for dynamic behavior
        
        // Create initial platforms
        if (this.platforms) {
          // Start with a platform at the bottom - no need for green tint now
          const basePlatform = this.platforms.create(400, 550, 'platform');
          basePlatform.setScale(0.5, 0.5); // Adjust scale to fit your custom platform image
          basePlatform.setData('type', 'regular');
          basePlatform.setImmovable(true);
          
          // Create more initial platforms going much higher
          // This ensures there are already platforms in place when the game starts
          for (let i = 0; i < 25; i++) { // Increased from 10 to 25
            const variance = Math.sin(i * 0.5) * 300;
            const x = 400 + variance;
            const y = 500 - (i * 80);
            
            let platformType = 'regular';
            if (i > 3) {
              const rnd = Math.random();
              if (rnd < 0.25) platformType = 'moving';
              else if (rnd < 0.4) platformType = 'breakable';
            }
            
            this.createPlatform(x, y, platformType);
          }
        }
        
        // Player character setup - use hedgy1 instead of 'player'
        this.player = this.physics.add.sprite(400, 500, 'hedgy1');
        this.player.setBounce(0);
          this.player.setCollideWorldBounds(true);
          
        // Initial upward velocity
        this.player.setVelocityY(-400);

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
                // Apply bounce
                p.setVelocityY(-720);
                
                // Switch to hedgy2 sprite for bounce animation
                p.setTexture('hedgy2');
                
                // Switch back to hedgy1 after a short delay
                this.time.delayedCall(200, () => {
                  if (p.active) { // Check if sprite still exists
                    p.setTexture('hedgy1');
                  }
                });
                
                // Visual feedback on platform
                plat.setTintFill(0x00FF00);
                this.time.delayedCall(100, () => {
                  plat.clearTint();
                });
                
                // Handle special platform types
                const platformType = plat.getData('type');
                
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
        
        // Setup controls - both arrow keys and A/D
          this.cursors = this.input.keyboard?.createCursorKeys();

        // Add A and D keys
        this.keys = {
          A: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          D: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          S: this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S)
        };

        // Move the score text creation to AFTER all other setup
        // Score display - create this AFTER everything and set highest depth
          this.scoreText = this.add.text(16, 16, 'Score: 0', { 
          fontSize: '24px',
          color: '#fff',
          stroke: '#000',
          strokeThickness: 3
        })
        .setScrollFactor(0)
        .setDepth(100);

        // Initialize boost items group
        this.boostItems = this.physics.add.group();
        this.lastBoostSpawn = 0;
        this.boostActive = false;
        this.boostCollected = false; // Reset the collected flag
        
        // Add collision between player and boost items
        if (this.player && this.boostItems) {
          this.physics.add.overlap(
            this.player,
            this.boostItems,
            (object1, object2) => {
              // Cast to proper types after the callback is called with correct parameters
              const p = object1 as Phaser.Physics.Arcade.Sprite;
              const item = object2 as Phaser.Physics.Arcade.Sprite;
              this.collectBoostItem(p, item);
            },
            undefined,
            this
          );
        }
        
        // Initialize mini-boost state
        this.miniBoostAvailable = true;
      }
      
      update(time: number, delta: number) {
        if (!this.player || !this.cursors || !this.platforms || !this.scoreText || !this.keys || this.isGameOver) return;
        
        // IMPROVED CAMERA MOVEMENT:
        // Only move platforms when player is moving upward and above threshold
        // This allows players to fall back onto the same platforms
        const CAMERA_THRESHOLD = 250;
        
        // Move clouds continuously when player is moving upward, regardless of position
        if (this.player.body && this.player.body.velocity.y < 0 && this.clouds) {
          // Calculate movement factor based on player's upward velocity
          const velocityFactor = Math.abs(this.player.body.velocity.y) / 1000;
          
          this.clouds.getChildren().forEach((child: any) => {
            const cloud = child as Phaser.GameObjects.Image;
            const depth = cloud.getData('depth') || 1;
            
            // Move clouds based on player velocity and cloud depth
            // Use three distinct speed factors for the three depth layers
            let speedFactor;
            if (depth === 0) {
              // Far background - moves slowest
              speedFactor = 0.6;
            } else if (depth === 1) {
              // Middle layer
              speedFactor = 1.5;
            } else {
              // Foreground - moves fastest
              speedFactor = 2.5;
            }
            
            cloud.y += velocityFactor * speedFactor * 15;
            
            // Add subtle horizontal drift based on depth
            // This creates a more dynamic feel
            if (depth === 0) {
              // Far clouds drift very slowly
              cloud.x += Math.sin(time / 5000) * 0.1;
            } else if (depth === 1) {
              // Middle clouds drift a bit more
              cloud.x += Math.sin(time / 3000 + cloud.y / 100) * 0.2;
            } else {
              // Near clouds drift the most
              cloud.x += Math.sin(time / 2000 + cloud.y / 50) * 0.3;
            }
            
            // Recycle clouds that move off-screen
            if (cloud.y > 900) {
              cloud.y = -100;
              cloud.x = Phaser.Math.Between(0, 800);
            }
            
            // Also recycle clouds that drift too far horizontally
            if (cloud.x < -100 || cloud.x > 900) {
              cloud.x = Phaser.Math.Between(100, 700);
            }
          });
        }
        
        // Original camera threshold logic for platforms
        if (this.player.y < CAMERA_THRESHOLD && this.player.body && this.player.body.velocity.y < 0) {
          // Only move platforms when player is moving UP and above threshold
          const diff = CAMERA_THRESHOLD - this.player.y;
          this.player.y = CAMERA_THRESHOLD;
          
          // Move all platforms down by the difference
          this.platforms.getChildren().forEach((child: any) => {
            child.y += diff;
          });
          
          // Move clouds at different speeds based on their depth
          if (this.clouds) {
            this.clouds.getChildren().forEach((child: any) => {
              const cloud = child as Phaser.GameObjects.Image;
              const depth = cloud.getData('depth') || 1;
              
              // Use three distinct speed factors for the three depth layers
              let speedFactor;
              if (depth === 0) {
                // Far background - moves slowest
                speedFactor = 0.3;
              } else if (depth === 1) {
                // Middle layer
                speedFactor = 0.8;
              } else {
                // Foreground - moves fastest
                speedFactor = 1.8;
              }
              
              cloud.y += diff * speedFactor;
            });
          }
          
          // Update highest point and score
          this.highestY -= diff;
          const newScore = Math.floor(Math.abs(this.highestY) / 10);
          
          // Only update UI and check milestones if score has changed
          if (newScore !== this.score) {
            this.score = newScore;
            this.scoreText.setText(`Score: ${this.score}`);
            onScoreUpdate(this.score);
            
            // Check for score milestones (every 100 points)
            const currentMilestone = Math.floor(this.score / 100);
            if (currentMilestone > this.lastMilestone) {
              console.log(`Reached milestone ${currentMilestone}, last was ${this.lastMilestone}`); // Debug log
              this.lastMilestone = currentMilestone;
              this.showMotivationalText();
            }
          }
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
            } else if (platform.x > 350) {
              platform.setData('direction', -1);
            }
          }
        });
        
        // Player horizontal movement with proper sprite flipping
        if (this.cursors.left.isDown || (this.keys.A && this.keys.A.isDown)) {
          this.player.setVelocityX(-300);
          this.player.setFlipX(true); // Flip sprite when moving left
        } else if (this.cursors.right.isDown || (this.keys.D && this.keys.D.isDown)) {
          this.player.setVelocityX(300);
          this.player.setFlipX(false); // Don't flip sprite when moving right
          } else {
            this.player.setVelocityX(0);
          }

        // Wrap player around screen edges with wider screen
        if (this.player.x < 0) {
          this.player.x = 800;
        } else if (this.player.x > 800) {
            this.player.x = 0;
        }
        
        // Clean up platforms and generate new ones
        this.cleanupPlatforms();
        this.generatePlatforms();
        
        // Game over when falling too far - adjust for taller screen
        if (this.player.y > CAMERA_THRESHOLD + 700) { // Increased from 500 to 700
          this.gameOver();
        }

        // Check if we should spawn a boost item
        this.spawnBoostItem();
        
        // Move boost items down with camera movement
        if (this.player && this.player.y < CAMERA_THRESHOLD && this.player.body && this.player.body.velocity.y < 0) {
          const diff = CAMERA_THRESHOLD - this.player.y;
          
          // Move boost items at a much faster speed (3x the platform speed)
          if (this.boostItems) {
            this.boostItems.getChildren().forEach((child: any) => {
              child.y += diff * 5.0; // Move 5x faster than platforms for better visibility
              
              // Remove boost items that fall off the bottom
              if (child.y > 900) {
                child.destroy();
              }
            });
          }
        }

        // Check for down or S key press for mini-boost
        if ((this.cursors.down?.isDown || this.keys.S?.isDown) && this.miniBoostAvailable) {
          this.applyMiniBoost();
        }
      }

      // Create platform with specified type
      createPlatform(x: number, y: number, type: string = 'regular') {
        if (!this.platforms) return null;
        
        const platform = this.platforms.create(x, y, 'platform');
        
        // Adjust scale based on the new image dimensions
        // You may need to adjust these values based on your actual image size
        platform.setScale(0.5, 0.5); // Adjust scale to fit your custom platform image
        
        platform.setData('type', type);
        platform.setImmovable(true);
        
        // Setup special platform types with tints
        if (type === 'moving') {
          platform.setTint(0x0088ff); // Blue tint for moving platforms
          platform.setData('direction', Math.random() > 0.5 ? 1 : -1);
          platform.setData('speed', Phaser.Math.Between(120, 200));
        } else if (type === 'breakable') {
          platform.setTint(0xff8800); // Orange tint for breakable platforms
        } else {
          // Regular platforms don't need a tint anymore since we're using a custom image
          // platform.setTint(0x00ff00); // Remove this line or comment it out
        }
        
        return platform;
      }

      // Clean up platforms that are off-screen
      cleanupPlatforms() {
        if (!this.platforms || !this.player) return;
        
        this.platforms.getChildren().forEach((child: any) => {
          if (child.y > this.player!.y + 600) {
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
        
        // Generate new platforms much further ahead (off-screen)
        // This ensures platforms are already in place before they become visible
        if (highestY > this.player.y - 800) { // Generate platforms much further ahead (was 300)
          // Add platforms with proper spacing
          const PLATFORM_COUNT = Math.max(2, 5 - Math.floor(this.score / 200));
          
          for (let i = 0; i < PLATFORM_COUNT; i++) {
            // Significantly more challenging gaps as score increases
            const minGap = Math.min(180, 100 + this.score / 10); 
            const maxGap = Math.min(300, 150 + this.score / 5);
            
            const gap = Phaser.Math.Between(minGap, maxGap);
            const y = highestY - (i + 1) * gap;
            
            // More variance in horizontal positioning for wider screen
            let x;
            if (Math.random() < 0.4) {
              // Place near edges 40% of the time at higher scores
              x = Math.random() < 0.5 ? 
                Phaser.Math.Between(50, 200) : // Left side
                Phaser.Math.Between(600, 750); // Right side
            } else {
              // Otherwise place more centrally but with variance
              x = Phaser.Math.Between(200, 600);
            }
            
            // Platform type distribution
            let type = 'regular';
            const rnd = Math.random();
            
            if (this.score > 100) {
              if (rnd < 0.4) type = 'moving';
              else if (rnd < 0.7) type = 'breakable';
            } else if (this.score > 50) {
              if (rnd < 0.3) type = 'moving';
              else if (rnd < 0.5) type = 'breakable';
            } else if (this.score > 20) {
              if (rnd < 0.2) type = 'moving';
              else if (rnd < 0.3) type = 'breakable';
            }
            
            this.createPlatform(x, y, type);
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
        
        // Game over text - moved higher up
        this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2 - 100, // Move up by 100px
          'Game Over',
          { 
            fontSize: '40px',
            color: '#fff',
            stroke: '#000',
            strokeThickness: 6
          }
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
        
        // Show score - also moved higher
        this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2 - 50, // Move up by 50px
          `Score: ${this.score}`,
          { 
            fontSize: '30px',
            color: '#fff',
            stroke: '#000',
            strokeThickness: 4
          }
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);
      }

      // Add a method to create clouds
      createCloud() {
        if (!this.clouds) return;
        
        // Random position
        const x = Phaser.Math.Between(0, 800);
        const y = Phaser.Math.Between(0, 800);
        
        // Randomly choose between cloud1, cloud2, and cloud3
        const cloudIndex = Math.floor(Math.random() * 3) + 1;
        const cloudKey = `cloud${cloudIndex}`;
        
        // Create cloud with the selected image
        const cloud = this.add.image(x, y, cloudKey);
        
        // Create three distinct depth layers instead of just two
        // This will give us more parallax variation
        let scale, depth;
        const layerRnd = Math.random();
        
        if (layerRnd < 0.33) {
          // Far background layer - small clouds
          scale = Phaser.Math.FloatBetween(0.2, 0.5);
          depth = 0;
          cloud.setAlpha(Phaser.Math.FloatBetween(0.2, 0.4)); // More transparent
          cloud.setTint(0xccccff); // Slight blue tint for distant clouds
        } else if (layerRnd < 0.66) {
          // Middle layer
          scale = Phaser.Math.FloatBetween(0.5, 0.9);
          depth = 1;
          cloud.setAlpha(Phaser.Math.FloatBetween(0.4, 0.7));
          cloud.setTint(0xddddff); // Very slight blue tint
        } else {
          // Foreground layer - larger clouds
          scale = Phaser.Math.FloatBetween(0.9, 1.5);
          depth = 2;
          cloud.setAlpha(Phaser.Math.FloatBetween(0.7, 0.9));
        }
        
        cloud.setScale(scale);
        
        // Randomly flip horizontally for more variety (50% chance)
        if (Math.random() > 0.5) {
          cloud.setFlipX(true);
        }
        
        // Set depth for rendering order
        cloud.setDepth(depth);
        cloud.setData('depth', depth);
        
        // Add to group
        this.clouds.add(cloud);
        
        return cloud;
      }

      // Update the motivational text to appear from above
      showMotivationalText() {
        console.log("Showing motivational text at score:", this.score); // Debug log
        
        try {
          // Create a simpler text without gradient effects first
          const motivationalText = this.add.text(
            400, -100, // Start above the visible area
            "Keep going. Valhalla is near!", 
            { 
              fontFamily: 'Arial',
              fontSize: '40px',
              fontStyle: 'bold',
              align: 'center',
              stroke: '#0033aa',
              strokeThickness: 8,
              color: '#ff00ff' // Bright pink color instead of gradient
            }
          );
          
          // Center the text horizontally
          motivationalText.setOrigin(0.5);
          
          // Set a high depth to appear above clouds but below score
          motivationalText.setDepth(90);
          
          // Add a glow effect
          motivationalText.setShadow(0, 0, '#0055ff', 12, true, true);
          
          // Make the text scroll with the game world
          motivationalText.setScrollFactor(1);
          
          // Store the text's initial world position
          const initialWorldY = this.cameras.main.scrollY - 200;
          motivationalText.y = initialWorldY;
          
          // Make the text slowly fade in
          motivationalText.setAlpha(0);
          this.tweens.add({
            targets: motivationalText,
            alpha: 1,
            duration: 1000,
            ease: 'Sine.easeIn'
          });
          
          // Simple color cycling without using context
          let colorIndex = 0;
          const colors = [
            0xff0099, // Pink
            0x493bc4, // Purple
            0x0033aa, // Dark blue
            0x00c3ff, // Cyan
            0x00ffa3, // Teal
            0xffea00  // Yellow
          ];
          
          const colorTicker = this.time.addEvent({
            delay: 100,
            callback: () => {
              colorIndex = (colorIndex + 1) % colors.length;
              motivationalText.setFill('#' + colors[colorIndex].toString(16).padStart(6, '0'));
            },
            callbackScope: this,
            loop: true
          });
          
          // Add the text to a custom update function
          const updateText = (time: number, delta: number) => {
            if (!motivationalText.active) {
              this.events.off('update', updateText);
              return;
            }
            
            const cameraY = this.cameras.main.scrollY;
            const targetY = initialWorldY + cameraY * 0.2;
            
            motivationalText.y += (targetY - motivationalText.y) * 0.05;
            
            if (motivationalText.y > cameraY + 900) {
              if (!motivationalText.getData('fading')) {
                motivationalText.setData('fading', true);
                this.tweens.add({
                  targets: motivationalText,
                  alpha: 0,
                  duration: 1000,
                  onComplete: () => {
                    colorTicker.destroy();
                    motivationalText.destroy();
                  }
                });
              }
            }
          };
          
          this.events.on('update', updateText);
          
          // Add a debug text that's always visible to confirm the function is called
          const debugText = this.add.text(
            400, 100,
            "Keep going. Valhalla is near!",
            {
              fontSize: '20px',
              color: '#ff0000',
              backgroundColor: '#ffffff'
            }
          )
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(101);
          
          // Remove debug text after 3 seconds
          this.time.delayedCall(3000, () => {
            debugText.destroy();
          });
          
        } catch (error) {
          console.error("Error in showMotivationalText:", error);
        }
      }

      // Update the collectBoostItem method to ensure particles stay under the player
      collectBoostItem(p: Phaser.Physics.Arcade.Sprite, item: Phaser.Physics.Arcade.Sprite) {
        // Remove the boost item
        item.destroy();
        
        // Prevent collecting multiple boosts at once
        if (this.boostActive) return;
        this.boostActive = true;
        
        // Mark that we've collected a boost for the current milestone
        this.boostCollected = true;
        
        // Apply a massive upward boost
        p.setVelocityY(-2000); // Much stronger than normal jump
        
        // Add visual effects
        
        // 1. Camera shake
        this.cameras.main.shake(500, 0.02);
        
        // 2. Character animation - rapid flashing
        const flashTween = this.tweens.add({
          targets: p,
          alpha: 0.2,
          duration: 50,
          yoyo: true,
          repeat: 10
        });
        
        // 3. Create particles that are directly attached to the player
        // Instead of using a particle manager, create individual particles each frame
        // that are precisely positioned under the player
        
        // Create a container to hold our custom particles
        const particleContainer = this.add.container(0, 0);
        
        // Function to create and position a single particle
        const createParticle = () => {
          if (!p.active) return;
          
          // Create a sprite at a position much lower under the player
          // Increase the y-offset from +40 to +70 to position it significantly lower
          const particle = this.add.sprite(p.x, p.y + 70, 'boost-item');
          particle.setScale(0.2 * Math.random() + 0.1); // Random size
          particle.setAlpha(0.8);
          particle.setAngle(Math.random() * 360); // Random rotation
          
          // Add to container for easier management
          particleContainer.add(particle);
          
          // Animate the particle
          this.tweens.add({
            targets: particle,
            y: particle.y + 50 + Math.random() * 50, // Move down
            x: particle.x + (Math.random() * 40 - 20), // Slight horizontal drift
            alpha: 0,
            scale: 0,
            duration: 500 + Math.random() * 300,
            onComplete: () => {
              particle.destroy();
            }
          });
        };
        
        // Create particles at regular intervals
        const particleTimer = this.time.addEvent({
          delay: 30, // Create particles more frequently
          callback: createParticle,
          callbackScope: this,
          loop: true,
          repeat: 60 // Create 60 particles over ~2 seconds
        });
        
        // Show boost text that follows the player
        const boostText = this.add.text(
          p.x, 
          p.y - 50,
          "SUPER POOPER BOOST!",
          {
            fontSize: '24px',
            color: '#ffff00',
            stroke: '#ff0000',
            strokeThickness: 6
          }
        )
        .setOrigin(0.5)
        .setDepth(100);
        
        // Make text follow player more precisely with a direct update
        // instead of using a timer
        const updateTextPosition = () => {
          if (p.active && boostText.active) {
            boostText.setPosition(p.x, p.y - 50);
          }
        };
        
        // Add the update function to the scene's update event
        const updateListener = this.events.on('update', updateTextPosition);
        
        // Clean up after boost effect ends
        this.time.delayedCall(2000, () => {
          particleTimer.destroy();
          particleContainer.destroy(true); // Destroy container and all children
          boostText.destroy();
          this.events.off('update', updateTextPosition, undefined, false);
          this.boostActive = false;
        });
      }
      
      // Update the spawnBoostItem method to make the boost appear closer to the player
      spawnBoostItem() {
        if (!this.boostItems) return;
        
        // Calculate the current milestone (hundreds)
        const currentHundred = Math.floor(this.score / 100);
        
        // Only spawn a boost if:
        // 1. We're past the first hundred (score > 100)
        // 2. We haven't spawned a boost for this hundred yet
        // 3. Either this is the first boost (lastBoostSpawn = 0) OR
        //    we collected the previous boost (boostCollected = true)
        if (currentHundred > 0 && 
            currentHundred > this.lastBoostSpawn && 
            (this.lastBoostSpawn === 0 || this.boostCollected)) {
          
          console.log(`Spawning boost item for level ${currentHundred}00 at score ${this.score}`);
          this.lastBoostSpawn = currentHundred;
          this.boostCollected = false; // Reset for the next milestone
          
          // IMPORTANT: Remove any existing boost items before creating a new one
          this.boostItems.clear(true, true); // This destroys all existing boost items
          
          // Spawn the boost item much closer to the player's current position
          // This makes it easier to collect
          const x = Phaser.Math.Between(200, 600);
          const y = this.player ? this.player.y - 200 : 100; // Just above the player
          
          const boostItem = this.boostItems.create(x, y, 'boost-item');
          boostItem.setScale(0.5); // Adjust size as needed
          
          // Make it move with the world
          boostItem.setScrollFactor(1);
          
          // Add a glow effect
          const glowTween = this.tweens.add({
            targets: boostItem,
            alpha: { from: 0.7, to: 1 },
            duration: 800,
            yoyo: true,
            repeat: -1
          });
          
          // Add a floating effect
          this.tweens.add({
            targets: boostItem,
            y: y + 20,
            duration: 1500,
            yoyo: true,
            repeat: -1
          });
          
          // Add a gentle rotation effect
          this.tweens.add({
            targets: boostItem,
            angle: 360,
            duration: 8000, // Slower rotation
            repeat: -1,
            ease: 'Linear'
          });
          
          // Add a timeout to remove this boost item if not collected
          // This ensures it doesn't stay around forever
          this.time.delayedCall(15000, () => {
            if (boostItem.active) {
              boostItem.destroy();
            }
          });
        }
      }

      // Add method for mini-boost
      applyMiniBoost() {
        if (!this.player || !this.miniBoostAvailable) return;
        
        // Only allow mini-boost when falling
        if (this.player.body && this.player.body.velocity.y > 0) {
          // Apply a small upward boost
          this.player.setVelocityY(-300); // Small upward boost
          
          // Create fart animation
          const fartParticles = this.add.particles(this.player.x, this.player.y + 30, 'fart', {
            speed: { min: 50, max: 150 },
            angle: { min: 80, max: 100 }, // Mostly downward
            scale: { start: 0.2, end: 0 },
            lifespan: 500,
            quantity: 5,
            blendMode: 'ADD',
            emitting: false
          });
          
          // Emit particles in a burst
          fartParticles.emitParticleAt(this.player.x, this.player.y + 30, 10);
          
          // Add a small camera shake
          this.cameras.main.shake(100, 0.01);
          
          // Play a quick squish animation on the player
          this.tweens.add({
            targets: this.player,
            scaleX: 1.2,
            scaleY: 0.8,
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeOut'
          });
          
          // Set cooldown
          this.miniBoostAvailable = false;
          this.time.delayedCall(this.miniBoostCooldown, () => {
            this.miniBoostAvailable = true;
          });
          
          // Clean up particles after animation
          this.time.delayedCall(500, () => {
            if (fartParticles) fartParticles.destroy();
          });
        }
      }
    }

    // Only create the game if it doesn't exist
    if (!gameInstance && gameContainerRef.current) {
      // Get the container dimensions to set the game size
      const containerWidth = gameContainerRef.current.clientWidth;
      const containerHeight = gameContainerRef.current.clientHeight;
      
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.CANVAS,
        width: 800,
        height: 900, // Increase base height to 900px to match container maxHeight
        parent: gameContainerRef.current,
        backgroundColor: '#87CEEB',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 1000 },
            debug: false
          }
        },
        scene: [DoodleJumpScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 800,
          height: 900, // Match the container maxHeight
        }
      };

      console.log("Creating new Phaser game instance");
      gameInstance = new Phaser.Game(config);
      isGameInitialized = true;
      
      // Add resize handler to adjust game size when window is resized
      const resizeGame = () => {
        if (gameInstance && gameContainerRef.current) {
          const width = gameContainerRef.current.clientWidth;
          const height = gameContainerRef.current.clientHeight;
          gameInstance.scale.resize(width, height);
        }
      };
      
      window.addEventListener('resize', resizeGame);
    }

    // Cleanup function
    return () => {
      // Don't destroy the game on component unmount to prevent flickering
      // We'll handle cleanup elsewhere if needed
    };
  }, [gameStarted, onScoreUpdate]);

  if (!gameStarted) {
    return (
      <div className="rounded-lg flex flex-col items-center justify-center relative overflow-hidden" 
           style={{ 
             width: '100%', 
             maxWidth: '800px',
             height: '100vh', 
             maxHeight: '900px',
             margin: '0 auto',
             background: 'linear-gradient(to bottom, #96ceec, #11a4f3)' // Updated gradient colors
           }}>
        {/* Decorative clouds */}
        <div className="absolute w-full h-full overflow-hidden pointer-events-none">
          <img 
            src="/assets/clouds/cloud1.png" 
            className="absolute opacity-80" 
            style={{ 
              width: '120px', 
              top: '15%', 
              left: '10%',
              animation: 'float 20s infinite ease-in-out'
            }} 
          />
          <img 
            src="/assets/clouds/cloud2.png" 
            className="absolute opacity-80" 
            style={{ 
              width: '150px', 
              top: '30%', 
              right: '15%',
              animation: 'float 25s infinite ease-in-out reverse'
            }} 
          />
          <img 
            src="/assets/clouds/cloud3.png" 
            className="absolute opacity-80" 
            style={{ 
              width: '100px', 
              top: '60%', 
              left: '20%',
              animation: 'float 22s infinite ease-in-out 1s'
            }} 
          />
          <img 
            src="/assets/clouds/cloud1.png" 
            className="absolute opacity-80" 
            style={{ 
              width: '130px', 
              top: '75%', 
              right: '10%',
              animation: 'float 18s infinite ease-in-out 2s'
            }} 
          />
        </div>
        
        <h2 className="text-white text-3xl font-bold mb-6 text-center z-10">Hedgy Jump</h2>
        <p className="text-white text-lg mb-4 text-center z-10">Use arrow keys or A/D to move left and right</p>
        
        {/* Tournament information box */}
        <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 mb-6 max-w-md z-10">
          <h3 className="text-white text-xl font-semibold mb-2 text-center">Daily Tournament</h3>
          <p className="text-white text-sm mb-2 text-center">
            Contribute at least 1 USDC to enter the tournament pool.
          </p>
          <p className="text-white text-sm text-center">
            The player with the highest score when the countdown ends wins the entire prize pool!
          </p>
        </div>
        
        <button 
          onClick={startGame}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-xl transition-all z-10"
        >
          Start Game
        </button>
        
        {/* Animation keyframes */}
        <style>
          {`
            @keyframes float {
              0%, 100% {
                transform: translateY(0) translateX(0);
              }
              25% {
                transform: translateY(-15px) translateX(10px);
              }
              50% {
                transform: translateY(5px) translateX(-10px);
              }
              75% {
                transform: translateY(-5px) translateX(5px);
              }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      maxWidth: '800px',
      height: '100vh', 
      maxHeight: '900px',
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
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-xl"
            style={{ marginTop: '150px' }} // Position the button lower
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default DoodleJumpGame;