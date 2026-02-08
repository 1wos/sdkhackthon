# Moru Examples

Practical patterns for common use cases.

---

## AI Agent Code Execution

Run LLM-generated code safely:

```python
from moru import Sandbox

def execute_code(code: str, language: str = "python") -> dict:
    """Safely execute code in isolated sandbox."""
    with Sandbox.create() as sbx:
        if language == "python":
            sbx.files.write("/app/script.py", code)
            result = sbx.commands.run("python3 /app/script.py", timeout=30)
        elif language == "javascript":
            sbx.files.write("/app/script.js", code)
            result = sbx.commands.run("node /app/script.js", timeout=30)
        else:
            return {"error": f"Unsupported language: {language}"}

        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.exit_code,
            "success": result.exit_code == 0
        }

# Usage
output = execute_code("""
import math
print(f"Pi is approximately {math.pi:.4f}")
""")
print(output["stdout"])
```

---

## Web Scraping

Install packages, run scraper, get results:

```python
from moru import Sandbox

with Sandbox.create(timeout=300) as sbx:
    # Install scraping packages
    sbx.commands.run("pip install requests beautifulsoup4", user="root", timeout=120)

    # Write scraper
    sbx.files.write("/app/scraper.py", """
import requests
from bs4 import BeautifulSoup

url = "https://news.ycombinator.com"
r = requests.get(url)
soup = BeautifulSoup(r.text, 'html.parser')

for item in soup.select('.titleline > a')[:5]:
    print(item.text)
""")

    # Run scraper
    result = sbx.commands.run("python3 /app/scraper.py", timeout=60)
    print(result.stdout)
```

---

## Long-Running Server with Public URL

```python
from moru import Sandbox
import time

sbx = Sandbox.create(timeout=3600)  # 1 hour

try:
    # Write a simple API
    sbx.files.write("/app/server.py", """
from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({"message": "Hello from Moru!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
""")

    # Install Flask and start server
    sbx.commands.run("pip install flask", user="root", timeout=60)
    handle = sbx.commands.run("python3 /app/server.py", background=True)

    time.sleep(3)  # Wait for server to start

    # Get public URL
    url = sbx.get_host(8080)
    print(f"API available at: {url}")

    # Test it
    result = sbx.commands.run(f"curl -s localhost:8080")
    print(f"Response: {result.stdout}")

    input("Press Enter to stop server...")
    handle.kill()
finally:
    sbx.kill()
```

---

## Git Operations with Persistent Workspace

```python
from moru import Sandbox, Volume

# Create persistent volume
vol = Volume.create(name="project-workspace")

# First session - clone and modify
sbx = Sandbox.create(volume_id=vol.volume_id, volume_mount_path="/workspace")

sbx.commands.run("git clone https://github.com/user/repo /workspace/repo", timeout=120)
sbx.commands.run("cd /workspace/repo && echo 'new line' >> README.md")
sbx.commands.run("cd /workspace/repo && git add . && git status")
sbx.kill()

# Later session - continue work
sbx2 = Sandbox.create(volume_id=vol.volume_id, volume_mount_path="/workspace")
result = sbx2.commands.run("cd /workspace/repo && git diff")
print(result.stdout)  # Shows our changes
sbx2.kill()
```

---

## Data Processing Pipeline

```python
from moru import Sandbox, Volume
import json

vol = Volume.create(name="data-pipeline")

with Sandbox.create(
    volume_id=vol.volume_id,
    volume_mount_path="/data",
    timeout=600
) as sbx:
    # Install data processing packages
    sbx.commands.run("pip install pandas numpy", user="root", timeout=120)

    # Upload input data
    input_data = [
        {"name": "Alice", "score": 85},
        {"name": "Bob", "score": 92},
        {"name": "Charlie", "score": 78},
    ]
    sbx.files.write("/data/input.json", json.dumps(input_data))

    # Write processing script
    sbx.files.write("/app/process.py", """
import pandas as pd
import json

with open('/data/input.json') as f:
    data = json.load(f)

df = pd.DataFrame(data)
df['grade'] = df['score'].apply(lambda x: 'A' if x >= 90 else 'B' if x >= 80 else 'C')

result = df.to_dict('records')
with open('/data/output.json', 'w') as f:
    json.dump(result, f, indent=2)

print(f"Processed {len(df)} records")
print(df.to_string())
""")

    # Run processing
    result = sbx.commands.run("python3 /app/process.py")
    print(result.stdout)

# Download results without sandbox
output = vol.download("/data/output.json")
print(json.loads(output))
```

---

## Custom Template for ML Workloads

```python
from moru import Template, Sandbox
from moru.template import wait_for_port

# Build ML template with common packages
template = (
    Template()
    .from_python_image("3.11")
    .apt_install(["build-essential", "libopenblas-dev"])
    .pip_install([
        "numpy",
        "pandas",
        "scikit-learn",
        "matplotlib",
        "jupyter"
    ])
    .set_workdir("/workspace")
)

# Build once
Template.build(template, alias="ml-workspace", cpu_count=4, memory_mb=4096)

# Use for ML tasks
with Sandbox.create("ml-workspace") as sbx:
    sbx.files.write("/workspace/train.py", """
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(iris.data, iris.target)

clf = RandomForestClassifier(n_estimators=100)
clf.fit(X_train, y_train)

accuracy = clf.score(X_test, y_test)
print(f"Model accuracy: {accuracy:.2%}")
""")

    result = sbx.commands.run("python3 /workspace/train.py")
    print(result.stdout)
```

---

## Multi-File Project

```python
from moru import Sandbox

with Sandbox.create() as sbx:
    # Create project structure
    sbx.files.make_dir("/app/src")
    sbx.files.make_dir("/app/tests")

    # Write source files
    sbx.files.write("/app/src/calculator.py", """
def add(a, b):
    return a + b

def multiply(a, b):
    return a * b
""")

    sbx.files.write("/app/src/__init__.py", "")

    # Write tests
    sbx.files.write("/app/tests/test_calculator.py", """
import sys
sys.path.insert(0, '/app/src')

from calculator import add, multiply

def test_add():
    assert add(2, 3) == 5

def test_multiply():
    assert multiply(4, 5) == 20

if __name__ == '__main__':
    test_add()
    test_multiply()
    print("All tests passed!")
""")

    # Run tests
    result = sbx.commands.run("python3 /app/tests/test_calculator.py")
    print(result.stdout)
```

---

## Error Handling

```python
from moru import Sandbox
from moru.exceptions import (
    TimeoutException,
    CommandExitException,
    NotEnoughSpaceException,
)

with Sandbox.create() as sbx:
    try:
        # This might timeout
        result = sbx.commands.run("sleep 120", timeout=5)
    except TimeoutException:
        print("Command took too long, continuing...")

    try:
        # This will fail
        result = sbx.commands.run("python3 nonexistent.py")
        if result.exit_code != 0:
            print(f"Script failed: {result.stderr}")
    except CommandExitException as e:
        print(f"Command failed with exit code {e.exit_code}")

    try:
        # This might fill disk
        sbx.files.write("/huge_file", "x" * 1_000_000_000)
    except NotEnoughSpaceException:
        print("Disk full, cleaning up...")
        sbx.commands.run("rm -rf /tmp/*")
```

---

## JavaScript/TypeScript Examples

### Basic Usage

```typescript
import Sandbox from '@moru-ai/core'

const sbx = await Sandbox.create()

try {
  // Run command
  const result = await sbx.commands.run("echo 'Hello'")
  console.log(result.stdout)

  // Files
  await sbx.files.write("/app/data.json", JSON.stringify({ key: "value" }))
  const content = await sbx.files.read("/app/data.json")
  console.log(JSON.parse(content))
} finally {
  await sbx.kill()
}
```

### With Volume

```typescript
import Sandbox, { Volume } from '@moru-ai/core'

const vol = await Volume.create({ name: 'my-workspace' })

const sbx = await Sandbox.create('base', {
  volumeId: vol.volumeId,
  volumeMountPath: '/workspace',
  timeoutMs: 3600000,
})

// Work persists in /workspace
await sbx.commands.run("echo 'persistent' > /workspace/data.txt")
await sbx.kill()

// Access without sandbox
const content = await vol.download('/workspace/data.txt')
console.log(content.toString())
```

### Streaming Output

```typescript
await sbx.commands.run(
  "for i in 1 2 3; do echo $i; sleep 1; done",
  {
    onStdout: (data) => process.stdout.write(data),
    onStderr: (data) => process.stderr.write(data),
    timeoutMs: 30000,
  }
)
```
