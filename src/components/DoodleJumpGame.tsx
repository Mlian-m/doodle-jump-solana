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
      private platforms?: Phaser.Physics.Arcade.StaticGroup;
      private player?: Phaser.Physics.Arcade.Sprite;
      private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
      private score = 0;
      private scoreText?: Phaser.GameObjects.Text;
      private highestY = 0;
      private isGameOver = false;

      constructor() {
        super({ key: 'DoodleJumpScene' });
      }

      preload() {
        this.load.image('platform', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/platform.png');
        this.load.image('player', 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/sprites/phaser-dude.png');
      }

      create() {
        // Store this scene for external access
        gameScene = this;
        
        // Reset state
        this.isGameOver = false;
        this.score = 0;
        this.highestY = 0;
        
        // Configure world and camera
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.physics.world.setBounds(0, 0, 400, Number.MAX_SAFE_INTEGER);
        
        // Setup platforms
        this.platforms = this.physics.add.staticGroup();
        
        // Create starting platform
        const basePlatform = this.platforms.create(200, 550, 'platform');
        basePlatform.setScale(0.5).refreshBody();
        basePlatform.setTint(0x00ff00);
        
        // Create initial platforms with fixed positions
        for (let i = 0; i < 10; i++) {
          const x = 50 + (Math.floor(i / 2) % 4) * 100; // More deterministic positioning
          const y = 500 - (i * 80);
          const platform = this.platforms.create(x, y, 'platform');
          platform.setScale(0.5).refreshBody();
        }
        
        // Setup player
        this.player = this.physics.add.sprite(200, 500, 'player');
        this.player.setBounce(0);
        this.player.setCollideWorldBounds(true);
        this.player.setGravityY(600);
        
        // Camera follows player
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, 400, Number.MAX_SAFE_INTEGER);
        
        // Add collisions
        this.physics.add.collider(
          this.player,
          this.platforms,
          this.handleBounce,
          undefined,
          this
        );
        
        // Setup controls
        this.cursors = this.input.keyboard?.createCursorKeys();
        
        // Score display
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
          fontSize: '24px',
          color: '#fff',
          stroke: '#000',
          strokeThickness: 3
        }).setScrollFactor(0);
        
        // Give player initial jump after a small delay
        this.time.delayedCall(100, () => {
          if (this.player) {
            this.player.setVelocityY(-300);
          }
        });
      }
      
      handleBounce(player: any, platform: any) {
        if (player.body.velocity.y > 0) {
          player.setVelocityY(-500);
          
          // Visual feedback
          platform.setTintFill(0xffff00);
          this.tweens.add({
            targets: platform,
            scaleX: 0.45,
            scaleY: 0.45,
            duration: 50,
            yoyo: true,
            onComplete: () => {
              platform.clearTint();
            }
          });
        }
      }
      
      update() {
        if (!this.player || !this.cursors || !this.platforms || !this.scoreText || this.isGameOver) return;
        
        // Left-right movement with acceleration
        if (this.cursors.left.isDown) {
          if (this.player.body) {
            this.player.setVelocityX(Math.max(this.player.body.velocity.x - 20, -250));
          } else {
            this.player.setVelocityX(-250);
          }
        } else if (this.cursors.right.isDown) {
          if (this.player.body) {
            this.player.setVelocityX(Math.min(this.player.body.velocity.x + 20, 250));
          } else {
            this.player.setVelocityX(250);
          }
        } else {
          if (this.player.body) {
            this.player.setVelocityX(this.player.body.velocity.x * 0.9);
          } else {
            this.player.setVelocityX(0);
          }
        }
        
        // Screen wrapping
        if (this.player.x < 0) {
          this.player.x = 400;
        } else if (this.player.x > 400) {
          this.player.x = 0;
        }
        
        // Update score and generate platforms
        if (this.player.y < this.highestY) {
          this.highestY = this.player.y;
          
          this.score = Math.floor((500 - this.highestY) / 10);
          this.scoreText.setText(`Score: ${this.score}`);
          onScoreUpdate(this.score);
          
          // Create new platforms at moderate intervals
          if (this.highestY % 200 < 5) {
            // Add platforms in batches to reduce update overhead
            for (let i = 0; i < 2; i++) {
              const x = Phaser.Math.Between(50, 350);
              const y = this.highestY - 200 - (i * 100);
              const platform = this.platforms.create(x, y, 'platform');
              platform.setScale(0.5).refreshBody();
            }
            
            // Only clean up platforms periodically
            this.platforms.getChildren().forEach((child: any) => {
              if (child.y > this.player!.y + 800) {
                child.destroy();
              }
            });
          }
        }
        
        // Game over condition
        if (this.player.y > this.highestY + 600 && !this.isGameOver) {
          this.isGameOver = true;
          setGameOver(true); // Update React state
          
          this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'Game Over',
            { 
              fontSize: '32px',
              color: '#fff',
              stroke: '#000',
              strokeThickness: 4
            }
          ).setOrigin(0.5).setScrollFactor(0);
          
          // Don't automatically restart - let the player click the button
        }
      }
    }

    // Only create the game if it doesn't exist
    if (!gameInstance && gameContainerRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.CANVAS, // Use Canvas instead of WebGL for better stability
        width: 400,
        height: 600,
        parent: gameContainerRef.current,
        backgroundColor: '#87CEEB',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
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
           style={{ width: '400px', height: '600px', margin: '0 auto' }}>
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
    <div style={{ position: 'relative', width: '400px', height: '600px', margin: '0 auto' }}>
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