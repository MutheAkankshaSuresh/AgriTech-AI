from ultralytics import YOLO

model = YOLO("model/best.pt")

test_img = "../ml/data/seed_images/Cracked/cracked_0001.png"
results = model.predict(test_img)

results[0].show()
results[0].save("output/")


