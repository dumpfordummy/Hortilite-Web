from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# Allowed extensions for upload
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def debug_log(message):
    print(f"[DEBUG] {message}")

def clahe_correction(image, clip_limit=2.0, tile_grid_size=(8, 8)):
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    ycrcb = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)  # Convert to YCrCb color space
    ycrcb[:, :, 0] = clahe.apply(ycrcb[:, :, 0])  # Apply CLAHE to luminance channel
    return cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)  # Convert back to BGR color space

def gamma_correction(image, gamma=1.0):
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(256)]).astype("uint8")
    return cv2.LUT(image, table)

def dynamic_clahe_parameters(median_intensity):
    if median_intensity < 64:  # Dark image
        clip_limit = 2.0
        tile_grid_size = (8, 8)
    elif median_intensity < 128:  # Moderately dark
        clip_limit = 1.5
        tile_grid_size = (8, 8)
    elif median_intensity < 192:  # Normal brightness
        clip_limit = 1.2
        tile_grid_size = (8, 8)
    else:  # Overexposed
        clip_limit = 3.0
        tile_grid_size = (8, 8)
    return clip_limit, tile_grid_size

def dynamic_gamma(median_intensity):
    if median_intensity < 64:  # Underexposed
        return 1.2  # Brighten dark image
    elif median_intensity < 128:  # Moderately dark
        return 1.1  # Slight brightening
    elif median_intensity < 192:  # Normal brightness
        return 1.0  # No correction
    else:  # Overexposed
        return 0.6  # Strong darkening effect

@app.route('/process-image', methods=['POST'])
def process_image():
    try:
        # Create temp directory
        temp_dir = os.path.abspath(os.path.join("backend", "temp"))
        os.makedirs(temp_dir, exist_ok=True)

        # Check for file in the request
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        file = request.files['image']
        if file and allowed_file(file.filename):
            # Save uploaded file
            filename = secure_filename(file.filename)
            file_path = os.path.join(temp_dir, filename)
            file.save(file_path)

            # Load the image
            image = cv2.imread(file_path)
            if image is None:
                return jsonify({'error': 'Invalid image file'}), 400

            # Calculate median intensity
            gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            median_intensity = np.median(gray_image)
            debug_log(f"Median intensity: {median_intensity}")

            # Dynamically adjust CLAHE and gamma parameters
            clip_limit, tile_grid_size = dynamic_clahe_parameters(median_intensity)
            gamma_value = dynamic_gamma(median_intensity)
            debug_log(f"CLAHE: clip_limit={clip_limit}, tile_grid_size={tile_grid_size}")
            debug_log(f"Gamma value: {gamma_value}")

            # Apply CLAHE
            clahe_image = clahe_correction(image, clip_limit=clip_limit, tile_grid_size=tile_grid_size)

            # Apply Gamma Correction
            corrected_image = gamma_correction(clahe_image, gamma=gamma_value)

            # Save and return the processed image
            output_filename = f"processed_{filename}"
            output_path = os.path.join(temp_dir, output_filename)
            cv2.imwrite(output_path, corrected_image)

            return send_file(output_path, mimetype='image/png')

        return jsonify({'error': 'Invalid file type'}), 400

    except Exception as e:
        debug_log(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
