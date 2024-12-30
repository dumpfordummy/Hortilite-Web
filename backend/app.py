from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import os
from werkzeug.utils import secure_filename
from datetime import datetime


app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# @app.route('/analyze-growth', methods=['POST'])
# def analyze_growth():
#     if 'images' not in request.files:
#         return jsonify({"error": "No images provided"}), 400

#     files = request.files.getlist('images')
#     if len(files) < 2:
#         return jsonify({"error": "At least two images are required to calculate growth rate"}), 400

#     growth_data = []
#     green_percentages = []
#     timestamps = []

#     for file in files:
#         filename = secure_filename(file.filename)
#         file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
#         file.save(file_path)

#         try:
#             green_percentage = calculate_green_percentage(file_path)
#             green_percentages.append(green_percentage)
#             timestamps.append(datetime.now().isoformat())  # Use actual timestamp metadata if available
#             growth_data.append({
#                 "filename": filename,
#                 "green_percentage": green_percentages
#             })
#         finally:
#             os.remove(file_path)

#     # Calculate growth rates between consecutive images
#     growth_rates = []
#     for i in range(1, len(green_percentages)):
#         rate = ((green_percentages[i] - green_percentages[i - 1]) / green_percentages[i - 1]) * 100
#         growth_rates.append({
#             "from_image": growth_data[i - 1]['filename'],
#             "to_image": growth_data[i]['filename'],
#             "growth_rate": rate
#         })

#     return jsonify({
#         "growth_rates": growth_rates,
#         "details": growth_data
#     }), 200


@app.route('/process-and-analyze', methods=['POST'])
def process_and_analyze():
    if 'images' not in request.files:
        return jsonify({"error": "No images provided"}), 400

    files = request.files.getlist('images')
    if len(files) < 2:
        return jsonify({"error": "At least two images are required to process and analyze"}), 400

    processed_data = []
    green_percentages = []
    timestamps = []

    temp_dir = os.path.abspath(os.path.join("backend", "temp"))
    os.makedirs(temp_dir, exist_ok=True)

    try:
        for file in files:
            # Save the uploaded file
            filename = secure_filename(file.filename)
            file_path = os.path.join(temp_dir, filename)
            file.save(file_path)

            # Load the image
            image = cv2.imread(file_path)
            if image is None:
                return jsonify({'error': f'Invalid image file: {filename}'}), 400

            # Calculate median intensity
            gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            median_intensity = np.median(gray_image)
            debug_log(f"Median intensity for {filename}: {median_intensity}")

            # Dynamically adjust CLAHE and gamma parameters
            clip_limit, tile_grid_size = dynamic_clahe_parameters(median_intensity)
            gamma_value = dynamic_gamma(median_intensity)
            debug_log(f"CLAHE: clip_limit={clip_limit}, tile_grid_size={tile_grid_size}")
            debug_log(f"Gamma value: {gamma_value}")

            # Apply CLAHE
            clahe_image = clahe_correction(image, clip_limit=clip_limit, tile_grid_size=tile_grid_size)

            # Apply Gamma Correction
            corrected_image = gamma_correction(clahe_image, gamma=gamma_value)

            # Save the processed image
            output_filename = f"processed_{filename}"
            output_path = os.path.join(temp_dir, output_filename)
            cv2.imwrite(output_path, corrected_image)

            # Calculate the percentage of green area in the processed image
            green_percentage = calculate_green_percentage(output_path)
            green_percentages.append(green_percentage)
            timestamps.append(datetime.now().isoformat())  # Use actual timestamp metadata if available

            # Append processed data
            processed_data.append({
                "filename": filename,
                "processed_filename": output_filename,
                "green_percentage": green_percentage,
            })

        # Calculate growth rates between consecutive images
        growth_rates = []
        for i in range(1, len(green_percentages)):
            rate = ((green_percentages[i] - green_percentages[i - 1]) / green_percentages[i - 1]) * 100
            growth_rates.append({
                "from_image": processed_data[i - 1]['filename'],
                "to_image": processed_data[i]['filename'],
                "growth_rate": rate,
                "timestamp_from": timestamps[i - 1],
                "timestamp_to": timestamps[i]
            })

        return jsonify({
            "processed_images": processed_data,
            "growth_rates": growth_rates
        }), 200

    except Exception as e:
        debug_log(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    finally:
        # Cleanup temporary files
        for file in os.listdir(temp_dir):
            file_path = os.path.join(temp_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)



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

def calculate_green_percentage(image_path):
    # Read the image
    image = cv2.imread(image_path)

    # Convert the image to HSV color space
    hsv_image = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Define the range for the green color
    lower_green = np.array([35, 40, 40])  # Adjust the lower range of green
    upper_green = np.array([85, 255, 255])  # Adjust the upper range of green

    # Create a binary mask where green colors are white
    mask = cv2.inRange(hsv_image, lower_green, upper_green)

    # Calculate the percentage of green area
    total_pixels = mask.size
    green_pixels = cv2.countNonZero(mask)
    green_percentage = (green_pixels / total_pixels) * 100

    return green_percentage

# @app.route('/process-image', methods=['POST'])
# def process_image():
#     try:
#         # Create temp directory
#         temp_dir = os.path.abspath(os.path.join("backend", "temp"))
#         os.makedirs(temp_dir, exist_ok=True)

#         # Check for file in the request
#         if 'image' not in request.files:
#             return jsonify({'error': 'No image file provided'}), 400

#         file = request.files['image']
#         if file and allowed_file(file.filename):
#             # Save uploaded file
#             filename = secure_filename(file.filename)
#             file_path = os.path.join(temp_dir, filename)
#             file.save(file_path)

#             # Load the image
#             image = cv2.imread(file_path)
#             if image is None:
#                 return jsonify({'error': 'Invalid image file'}), 400

#             # Calculate median intensity
#             gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
#             median_intensity = np.median(gray_image)
#             debug_log(f"Median intensity: {median_intensity}")

#             # Dynamically adjust CLAHE and gamma parameters
#             clip_limit, tile_grid_size = dynamic_clahe_parameters(median_intensity)
#             gamma_value = dynamic_gamma(median_intensity)
#             debug_log(f"CLAHE: clip_limit={clip_limit}, tile_grid_size={tile_grid_size}")
#             debug_log(f"Gamma value: {gamma_value}")

#             # Apply CLAHE
#             clahe_image = clahe_correction(image, clip_limit=clip_limit, tile_grid_size=tile_grid_size)

#             # Apply Gamma Correction
#             corrected_image = gamma_correction(clahe_image, gamma=gamma_value)

#             # Save and return the processed image
#             output_filename = f"processed_{filename}"
#             output_path = os.path.join(temp_dir, output_filename)
#             cv2.imwrite(output_path, corrected_image)

#             return send_file(output_path, mimetype='image/png')

#         return jsonify({'error': 'Invalid file type'}), 400

#     except Exception as e:
#         debug_log(f"Error: {e}")
#         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
