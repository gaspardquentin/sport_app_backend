def u(n):
    return n * (5/6) ** (n-1)

def sommeU(p):
    s = 0
    for n in range(1, p):
        s = s + u(n)
    return s

treshold = 10**(-15)
s_bef = 0
s_aft = u(1)
n = 2
while s_aft - s_bef > treshold:
    s_bef = s_aft
    s_aft += u(n)
    n += 1
print(s_aft)
