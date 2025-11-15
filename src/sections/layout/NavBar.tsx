import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useEffect, useState } from "react";
import NavMenu from "./NavMenu";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import NavLink from "@/components/NavLink";
import Image from "next/image";
import { styled } from "@mui/material/styles";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebaseClient";

interface Props {
  darkMode: boolean;
  switchDarkMode: () => void;
}

// Styled component to make the link look like a button
const StyledIconButtonLink = styled("a")({
  color: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none", // Remove underline from link
  "&:hover": {
    cursor: "pointer", // Change cursor on hover
  },
});

export default function NavBar({ darkMode, switchDarkMode }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpAnchorEl, setHelpAnchorEl] = useState<null | HTMLElement>(null);
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    setDrawerOpen(false);
  }, [router.pathname]);

  const handleHelpClick = (event: React.MouseEvent<HTMLElement>) => {
    setHelpAnchorEl(event.currentTarget);
  };

  const handleHelpClose = () => {
    setHelpAnchorEl(null);
  };

  const handleCustomerSupport = () => {
    const subject = "Customer Support - Tembo Chess";
    const body = `Hello Tembo Support Team,

I would like assistance with:

• Issue description:
• Steps to reproduce:
• Expected behavior:
• Actual behavior:

Thank you for your help!`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=chesstembo@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
    handleHelpClose();
  };

  const handleSupportUs = () => {
    alert("Donation link will be added soon! Thank you for your support.");
    handleHelpClose();
  };

  const handlePrivacyPolicy = () => {
    window.open('/privacy-policy.html', '_blank');
    handleHelpClose();
  };

  const handleTermsOfService = () => {
    window.open('/terms-of-service.html', '_blank');
    handleHelpClose();
  };

  const handleAuth = () => {
    if (user) {
      // If user is logged in, show profile menu or go to profile page
      router.push('/profile');
    } else {
      // If user is not logged in, go to login page
      router.push('/login');
    }
  };

  return (
    <Box sx={{ flexGrow: 1, display: "flex" }}>
      <AppBar
        position="static"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: darkMode ? "#19191c" : "white",
          color: darkMode ? "white" : "black",
        }}
        enableColorOnDark
      >
        <Toolbar variant="dense">
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: "min(0.5vw, 0.6rem)", padding: 1, my: 1 }}
            onClick={() => setDrawerOpen((val) => !val)}
          >
            <Icon icon="mdi:menu" />
          </IconButton>

          <Image
            src="/favicon-32x32.png"
            alt="Tembo logo"
            width={32}
            height={32}
          />

          <NavLink href="/">
            <Typography
              variant="h6"
              component="div"
              sx={{
                flexGrow: 1,
                ml: 1,
                fontSize: { xs: "1rem", sm: "1.25rem" },
              }}
            >
              Tembo
            </Typography>
          </NavLink>

          {/* Auth Icon - Changes based on login status */}
          <Tooltip title={user ? "My Profile" : "Login / Sign Up"}>
            <IconButton
              color="inherit"
              onClick={handleAuth}
              aria-label={user ? "profile" : "login"}
              sx={{ ml: "min(0.6rem, 0.8vw)" }}
            >
              {user ? (
                <Icon icon="mdi:account" />
              ) : (
                <Icon icon="mdi:login" />
              )}
            </IconButton>
          </Tooltip>

          {/* Help Menu */}
          <Tooltip title="Help & Support">
            <IconButton
              color="inherit"
              onClick={handleHelpClick}
              aria-label="help"
              aria-controls="help-menu"
              aria-haspopup="true"
            >
              <Icon icon="mdi:help-circle-outline" />
            </IconButton>
          </Tooltip>

          <Menu
            id="help-menu"
            anchorEl={helpAnchorEl}
            open={Boolean(helpAnchorEl)}
            onClose={handleHelpClose}
            PaperProps={{
              sx: {
                backgroundColor: darkMode ? "#2d2d2d" : "white",
                color: darkMode ? "white" : "black",
                minWidth: 180,
              }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleCustomerSupport}>
              <ListItemIcon>
                <Icon 
                  icon="mdi:email-outline" 
                  fontSize={20}
                  color={darkMode ? "white" : "black"}
                />
              </ListItemIcon>
              <ListItemText>Customer Support</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleSupportUs}>
              <ListItemIcon>
                <Icon 
                  icon="mdi:heart-outline" 
                  fontSize={20}
                  color={darkMode ? "white" : "black"}
                />
              </ListItemIcon>
              <ListItemText>Support Us</ListItemText>
            </MenuItem>
            <MenuItem onClick={handlePrivacyPolicy}>
              <ListItemIcon>
                <Icon 
                  icon="mdi:shield-account-outline" 
                  fontSize={20}
                  color={darkMode ? "white" : "black"}
                />
              </ListItemIcon>
              <ListItemText>Privacy Policy</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleTermsOfService}>
              <ListItemIcon>
                <Icon 
                  icon="mdi:file-document-outline" 
                  fontSize={20}
                  color={darkMode ? "white" : "black"}
                />
              </ListItemIcon>
              <ListItemText>Terms of Service</ListItemText>
            </MenuItem>
          </Menu>

          <Tooltip title="GitHub Repository">
            <StyledIconButtonLink
              href="https://github.com/chesstembo/chesstembo"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ ml: "min(0.6rem, 0.8vw)" }}
            >
              <IconButton color="inherit" component="span">
                <Icon icon="mdi:github" />
              </IconButton>
            </StyledIconButtonLink>
          </Tooltip>

          <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <IconButton
              sx={{ ml: "min(0.6rem, 0.8vw)" }}
              onClick={switchDarkMode}
              color="inherit"
              edge="end"
            >
              {darkMode ? (
                <Icon icon="mdi:brightness-7" />
              ) : (
                <Icon icon="mdi:brightness-4" />
              )}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <NavMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Box>
  );
}