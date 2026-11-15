import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('13.140.213.195', username='root', password='omnysync67', timeout=15)

script = """
import sqlite3
con = sqlite3.connect('/var/www/car-rental/app_data/car_rental.db')
cur = con.cursor()
for r in cur.execute('SELECT * FROM tenants').fetchall():
    print('Tenant:', r)
for u in cur.execute('SELECT * FROM tenant_users').fetchall():
    print('User:', u)
"""

stdin, stdout, stderr = ssh.exec_command("python3")
stdin.write(script)
stdin.channel.shutdown_write()

print("STDOUT:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
