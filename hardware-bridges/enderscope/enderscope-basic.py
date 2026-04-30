# enderscope-basic.py - Version simplifiée unifiée
# Seulement pyserial requis - Remplace enderscope-minimal.py

import serial
import serial.tools.list_ports
import time

class SerialUtils:
    @staticmethod
    def serial_ports():
        """Liste les ports série disponibles"""
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append(port.device)
        return ports

class Stage:
    def __init__(self, port, baudrate=115200, homing=False, minimal_mode=False):
        """Initialise la connexion avec l'Enderscope
        Args:
            minimal_mode: Si True, utilise la configuration ultra-simple
        """
        self.port = port
        self.baudrate = baudrate
        self.position = {'X': 0.0, 'Y': 0.0, 'Z': 0.0}
        self.minimal_mode = minimal_mode
        
        try:
            # Connexion série avec timeout adaptatif
            timeout = 0.1 if minimal_mode else 2
            self.ser = serial.Serial(port, baudrate, timeout=timeout)
            time.sleep(2 if not minimal_mode else 0.5)
            
            print(f"✅ Connecté à {port} à {baudrate} bauds")
            
            # Purger le buffer série (messages de boot Marlin)
            self.ser.reset_input_buffer()
            
            if not minimal_mode:
                self.send_gcode("G21", wait_ok=True)  # Unités en mm
                self.send_gcode("G90", wait_ok=True)  # Positionnement absolu
                
                if homing:
                    self.home()
                
        except Exception as e:
            raise
    
    def send_gcode(self, command, wait_ok=False):
        """Envoie une commande G-code
        Args:
            command: commande G-code
            wait_ok: si True, attend la réponse 'ok' du firmware
        Returns:
            list of response lines (if wait_ok) or ["sent"]
        """
        if not self.ser.is_open:
            raise Exception("Port série fermé")
        
        if not command.endswith("\n"):
            command += "\n"
        
        self.ser.write(command.encode('utf-8'))
        
        if wait_ok:
            lines = []
            deadline = time.time() + 120
            while time.time() < deadline:
                line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                if not line:
                    continue
                lines.append(line)
                if line.startswith('ok'):
                    return lines
            print(f"⚠️ [{command.strip()}] TIMEOUT après 120s!")
            lines.append("timeout")
            return lines
        
        return ["sent"]
    
    def move_absolute(self, x, y, z, feedrate=3000):
        """Mouvement absolu vers X, Y, Z"""
        if self.minimal_mode:
            self.send_gcode("G21", wait_ok=True)
            self.send_gcode("G90", wait_ok=True)
        
        command = f"G1 X{x} Y{y} Z{z} F{feedrate}"
        self.send_gcode(command, wait_ok=True)
        self.position = {'X': float(x), 'Y': float(y), 'Z': float(z)}
    
    def finish_moves(self):
        """Attend que tous les mouvements soient terminés (M400)"""
        time.sleep(0.05)  # Laisser Marlin ajouter le G0 au motion planner
        self.send_gcode("M400", wait_ok=True)
    
    def move_relative(self, dx, dy, dz, feedrate=3000):
        """Mouvement relatif de dx, dy, dz"""
        self.send_gcode("G91", wait_ok=True)
        
        try:
            command = f"G1 X{dx} Y{dy} Z{dz} F{feedrate}"
            self.send_gcode(command, wait_ok=True)
            
            self.position['X'] += float(dx)
            self.position['Y'] += float(dy)
            self.position['Z'] += float(dz)
        finally:
            self.send_gcode("G90", wait_ok=True)
    
    def home(self):
        """Retour à l'origine (homing)"""
        self.send_gcode("G28", wait_ok=True)
        self.send_gcode("M400", wait_ok=True)
        self.position = {'X': 0.0, 'Y': 0.0, 'Z': 0.0}
    
    def get_position(self, dict=False):
        """Récupère la position actuelle"""
        if dict:
            return self.position
        else:
            return self.position['X'], self.position['Y'], self.position['Z']
    
    def close(self):
        """Ferme la connexion série"""
        if self.ser and self.ser.is_open:
            self.ser.close()
            print("🔌 Connexion fermée")

# Test simple si exécuté directement
if __name__ == "__main__":
    print("🔬 Test Enderscope Simple")
    
    # Liste les ports
    ports = SerialUtils.serial_ports()
    print(f"Ports disponibles: {ports}")
    
    if ports:
        try:
            # Connexion au premier port
            stage = Stage(ports[0], homing=False)
            
            # Test de mouvement
            print("Test mouvement relatif...")
            stage.move_relative(1, 0, 0)
            
            print(f"Position: {stage.get_position(dict=True)}")
            
            # Fermeture
            stage.close()
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
    else:
        print("❌ Aucun port série trouvé")