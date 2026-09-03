import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useLocation } from 'react-router-dom';

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  [`& .${breadcrumbsClasses.separator}`]: {
    color: theme.palette.action.disabled,
    margin: 1,
  },
  [`& .${breadcrumbsClasses.ol}`]: {
    alignItems: 'center',
  },
}));

const PAGE_CRUMBS: Record<string, string> = {
  '/': 'Sanitization',
  '/documentation': 'Documentation',
};

function resolvePageCrumb(pathname: string): string {
  return PAGE_CRUMBS[pathname] ?? 'Sanitization';
}

export default function NavbarBreadcrumbs() {
  const { pathname } = useLocation();
  const pageCrumb = resolvePageCrumb(pathname);

  return (
    <StyledBreadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNextRoundedIcon fontSize="small" />}
    >
      <Typography variant="body2" color="text.secondary">
        Fraud Guard
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
        {pageCrumb}
      </Typography>
    </StyledBreadcrumbs>
  );
}
